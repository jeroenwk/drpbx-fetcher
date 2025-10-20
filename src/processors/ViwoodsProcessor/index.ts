import { StreamingZipUtils } from "../../utils/StreamingZipUtils";
import { StreamLogger } from "../../utils/StreamLogger";
import { MetadataManager } from "../../utils/MetadataManager";
import { ViwoodsNoteMetadata } from "../../models/Settings";
import {
	FileProcessor,
	ProcessorConfig,
	ProcessorContext,
	ProcessorResult,
	FileMetadata,
	ValidationResult,
	ConfigSchema,
} from "../types";
import { ZipReader } from "@zip.js/zip.js";
import {
	ViwoodsProcessorConfig,
	ViwoodsModuleType,
	PACKAGE_TO_MODULE,
	HeaderInfo,
	LearningModuleConfig,
	PaperModuleConfig,
	DailyModuleConfig,
	MeetingModuleConfig,
	PickingModuleConfig,
	MemoModuleConfig,
} from "./ViwoodsTypes";
import { LearningProcessor } from "./modules/LearningProcessor";
import { PaperProcessor } from "./modules/PaperProcessor";
import { DailyProcessor } from "./modules/DailyProcessor";
import { MeetingProcessor } from "./modules/MeetingProcessor";
import { PickingProcessor } from "./modules/PickingProcessor";
import { MemoProcessor } from "./modules/MemoProcessor";
import { TemplateDefaults } from "./TemplateDefaults";

/**
 * Processor for viwoods files (all modules)
 * Handles both .note files and other resources (images, PDFs, etc.)
 */
export class ViwoodsProcessor implements FileProcessor {
	readonly type = "viwoods";
	readonly name = "Viwoods Files";
	readonly description = "Process viwoods files from all modules";
	readonly supportedExtensions = ["note", "jpg", "jpeg", "png", "gif", "pdf", "webp"];

	private metadataManager: MetadataManager | null = null;

	/**
	 * Initialize metadata manager with vault from context
	 * Called lazily on first use
	 */
	private initializeMetadataManager(context: ProcessorContext, paperConfig: PaperModuleConfig): void {
		if (this.metadataManager) return;

		// Store metadata in Paper resources folder as markdown with YAML frontmatter
		const metadataPath = `${paperConfig.notesFolder}/resources/viwoodsNoteMetadata.md`;

		this.metadataManager = new MetadataManager(
			metadataPath,
			async () => {
				// Load metadata from markdown file with YAML frontmatter
				try {
					const content = await context.vault.adapter.read(metadataPath);
					return MetadataManager.fromMarkdown(content);
				} catch (error) {
					// File doesn't exist yet - return empty
					return null;
				}
			},
			async (data: Record<string, ViwoodsNoteMetadata>) => {
				// Save metadata to markdown file with YAML frontmatter
				const markdown = MetadataManager.toMarkdown(data);
				// Ensure resources folder exists
				const resourcesFolder = `${paperConfig.notesFolder}/resources`;
				try {
					await context.vault.createFolder(resourcesFolder);
				} catch (error) {
					// Folder might already exist
				}
				await context.vault.adapter.write(metadataPath, markdown);
			}
		);
	}

	async process(
		fileData: Uint8Array,
		originalPath: string,
		metadata: FileMetadata,
		config: ProcessorConfig,
		context: ProcessorContext
	): Promise<ProcessorResult> {
		await StreamLogger.log(`[ViwoodsProcessor] Starting processing of ${metadata.name}`);
		await StreamLogger.log(`[ViwoodsProcessor] File size: ${fileData.length} bytes`);
		await StreamLogger.log(`[ViwoodsProcessor] Original path: ${originalPath}`);

		const viwoodsConfig = config as ViwoodsProcessorConfig;
		const fileExtension = metadata.name.split(".").pop()?.toLowerCase() || "";

		// Handle non-.note files (images, PDFs, etc.) - route to module handlers
		if (fileExtension !== "note") {
			await StreamLogger.log(`[ViwoodsProcessor] Non-.note file detected (${fileExtension}), routing to module handler...`);
			return await this.processNonNoteFile(fileData, originalPath, metadata, viwoodsConfig, context);
		}

		let zipReader: ZipReader<Blob> | null = null;

		try {
			await StreamLogger.log(`[ViwoodsProcessor] Loading ZIP file...`);

			// Create Blob from Uint8Array for streaming ZIP extraction
			const blob = new Blob([fileData]);

			// Load ZIP file using streaming
			zipReader = await StreamingZipUtils.loadZipFromBlob(blob);
			await StreamLogger.log(`[ViwoodsProcessor] ZIP file loaded successfully`);

			// Detect module type
			const allFiles = await StreamingZipUtils.listFiles(zipReader);
			await StreamLogger.log(`[ViwoodsProcessor] Files in ZIP:`, { count: allFiles.length });

			const moduleType = await this.detectModuleType(zipReader, allFiles, originalPath);
			await StreamLogger.log(`[ViwoodsProcessor] Detected module type: ${moduleType}`);

			// Route to appropriate module processor
			let result: ProcessorResult;

			switch (moduleType) {
				case ViwoodsModuleType.LEARNING:
					if (!viwoodsConfig.learning.enabled) {
						return {
							success: false,
							createdFiles: [],
							errors: ["Learning module is disabled in settings"],
						};
					}
					await StreamLogger.log(`[ViwoodsProcessor] Processing as Learning module...`);
					result = await LearningProcessor.process(
						zipReader,
						fileData,
						originalPath,
						metadata,
						viwoodsConfig.learning,
						context
					);
					break;

				case ViwoodsModuleType.PAPER:
					if (!viwoodsConfig.paper.enabled) {
						return {
							success: false,
							createdFiles: [],
							errors: ["Paper module is disabled in settings"],
						};
					}
					// Initialize metadata manager for Paper module
					this.initializeMetadataManager(context, viwoodsConfig.paper);
					if (!this.metadataManager) {
						return {
							success: false,
							createdFiles: [],
							errors: ["MetadataManager not initialized"],
						};
					}
					// Load metadata before processing
					await this.metadataManager.load();

					await StreamLogger.log(`[ViwoodsProcessor] Processing as Paper module...`);
					result = await PaperProcessor.process(
						zipReader,
						fileData,
						originalPath,
						metadata,
						viwoodsConfig.paper,
						context,
						this.metadataManager
					);
					// Save metadata after successful Paper processing
					if (result.success && this.metadataManager) {
						await this.metadataManager.save();
					}
					break;

				case ViwoodsModuleType.DAILY:
					if (!viwoodsConfig.daily.enabled) {
						return {
							success: false,
							createdFiles: [],
							errors: ["Daily module is disabled in settings"],
						};
					}
					await StreamLogger.log(`[ViwoodsProcessor] Processing as Daily module...`);
					result = await DailyProcessor.process(
						zipReader,
						fileData,
						originalPath,
						metadata,
						viwoodsConfig.daily,
						context
					);
					break;

				case ViwoodsModuleType.MEETING:
					if (!viwoodsConfig.meeting.enabled) {
						return {
							success: false,
							createdFiles: [],
							errors: ["Meeting module is disabled in settings"],
						};
					}
					await StreamLogger.log(`[ViwoodsProcessor] Processing as Meeting module...`);
					result = await MeetingProcessor.process(
						zipReader,
						fileData,
						originalPath,
						metadata,
						viwoodsConfig.meeting,
						context
					);
					break;

				case ViwoodsModuleType.PICKING:
					if (!viwoodsConfig.picking.enabled) {
						return {
							success: false,
							createdFiles: [],
							errors: ["Picking module is disabled in settings"],
						};
					}
					await StreamLogger.log(`[ViwoodsProcessor] Processing as Picking module...`);
					result = await PickingProcessor.process(
						zipReader,
						fileData,
						originalPath,
						metadata,
						viwoodsConfig.picking,
						context
					);
					break;

				case ViwoodsModuleType.MEMO:
					if (!viwoodsConfig.memo.enabled) {
						return {
							success: false,
							createdFiles: [],
							errors: ["Memo module is disabled in settings"],
						};
					}
					await StreamLogger.log(`[ViwoodsProcessor] Processing as Memo module...`);
					result = await MemoProcessor.process(
						zipReader,
						fileData,
						originalPath,
						metadata,
						viwoodsConfig.memo,
						context
					);
					break;

				default:
					return {
						success: false,
						createdFiles: [],
						errors: [`Unknown Viwoods module type: ${moduleType}`],
					};
			}

			// Close ZIP reader
			await StreamingZipUtils.close(zipReader);

			return result;
		} catch (error: unknown) {
			// Ensure cleanup even on error
			if (zipReader) {
				try {
					await StreamingZipUtils.close(zipReader);
				} catch (cleanupError) {
					// Ignore cleanup errors
				}
			}

			const err = error as Error;
			return {
				success: false,
				createdFiles: [],
				errors: [`Failed to process viwoods note: ${err.message}`],
			};
		}
	}

	/**
	 * Detect module type from HeaderInfo package name, file structure, or path
	 */
	private async detectModuleType(
		zipReader: ZipReader<Blob>,
		allFiles: string[],
		originalPath: string
	): Promise<ViwoodsModuleType> {
		// Try to detect from HeaderInfo.json package name (most reliable)
		const headerInfoFile = allFiles.find(f => f.endsWith("_HeaderInfo.json"));
		if (headerInfoFile) {
			try {
				const headerInfo = await StreamingZipUtils.extractJson<HeaderInfo>(zipReader, headerInfoFile);
				if (headerInfo && headerInfo.packageName) {
					const moduleType = PACKAGE_TO_MODULE[headerInfo.packageName];
					if (moduleType) {
						await StreamLogger.log(`[ViwoodsProcessor.detectModuleType] Detected from package: ${headerInfo.packageName} -> ${moduleType}`);
						return moduleType;
					}
				}
			} catch (error) {
				await StreamLogger.error(`[ViwoodsProcessor.detectModuleType] Failed to parse HeaderInfo:`, error);
			}
		}

		// Fallback: Detect from file structure
		const hasEpubFormat = allFiles.some(f => f.includes("_BookBean.json") || f.includes("_ReadNoteBean.json"));
		if (hasEpubFormat) {
			return ViwoodsModuleType.LEARNING;
		}

		const hasNoteFileInfo = allFiles.some(f => f.endsWith("_NoteFileInfo.json"));
		const hasNotesBean = allFiles.some(f => f.endsWith("_NotesBean.json"));
		const hasLayoutImage = allFiles.some(f => f.endsWith("_LayoutImage.json"));

		// Paper module: has NoteFileInfo
		if (hasNoteFileInfo && originalPath.includes("/Paper/")) {
			return ViwoodsModuleType.PAPER;
		}

		// Meeting module: has NoteFileInfo and Meeting path
		if (hasNoteFileInfo && originalPath.includes("/Meeting/")) {
			return ViwoodsModuleType.MEETING;
		}

		// Daily module: has NotesBean with date fields and Daily path
		if (hasNotesBean && originalPath.includes("/Daily/")) {
			return ViwoodsModuleType.DAILY;
		}

		// Picking module: has LayoutImage/NotesBean
		if (hasLayoutImage && hasNotesBean && originalPath.includes("/Picking/")) {
			return ViwoodsModuleType.PICKING;
		}

		// Memo module: Memo path
		if (originalPath.includes("/Memo/")) {
			return ViwoodsModuleType.MEMO;
		}

		// Default fallback to Paper if has NoteFileInfo
		if (hasNoteFileInfo) {
			return ViwoodsModuleType.PAPER;
		}

		return ViwoodsModuleType.UNKNOWN;
	}

	/**
	 * Process non-.note files (images, PDFs, etc.) by detecting module from path
	 * and routing to appropriate module handler
	 */
	private async processNonNoteFile(
		fileData: Uint8Array,
		originalPath: string,
		metadata: FileMetadata,
		viwoodsConfig: ViwoodsProcessorConfig,
		context: ProcessorContext
	): Promise<ProcessorResult> {
		const pathLower = originalPath.toLowerCase();

		// Detect module from path
		let moduleType: ViwoodsModuleType = ViwoodsModuleType.UNKNOWN;
		let moduleConfig: LearningModuleConfig | PaperModuleConfig | DailyModuleConfig | MeetingModuleConfig | PickingModuleConfig | MemoModuleConfig | null = null;

		if (pathLower.includes("/learning/")) {
			moduleType = ViwoodsModuleType.LEARNING;
			moduleConfig = viwoodsConfig.learning;
		} else if (pathLower.includes("/paper/")) {
			moduleType = ViwoodsModuleType.PAPER;
			moduleConfig = viwoodsConfig.paper;
		} else if (pathLower.includes("/daily/")) {
			moduleType = ViwoodsModuleType.DAILY;
			moduleConfig = viwoodsConfig.daily;
		} else if (pathLower.includes("/meeting/")) {
			moduleType = ViwoodsModuleType.MEETING;
			moduleConfig = viwoodsConfig.meeting;
		} else if (pathLower.includes("/picking/")) {
			moduleType = ViwoodsModuleType.PICKING;
			moduleConfig = viwoodsConfig.picking;
		} else if (pathLower.includes("/memo/")) {
			moduleType = ViwoodsModuleType.MEMO;
			moduleConfig = viwoodsConfig.memo;
		}

		if (moduleType === ViwoodsModuleType.UNKNOWN || !moduleConfig) {
			return {
				success: false,
				createdFiles: [],
				errors: [`Could not determine module type from path: ${originalPath}`],
			};
		}

		// Check if module is enabled
		if (!moduleConfig.enabled) {
			return {
				success: false,
				createdFiles: [],
				errors: [`${moduleType} module is disabled in settings`],
			};
		}

		await StreamLogger.log(`[ViwoodsProcessor.processNonNoteFile] Routing to ${moduleType} module...`);

		// Route to appropriate module handler
		// For now, only PickingProcessor handles non-.note files (screenshots)
		// Other modules can be extended in the future
		switch (moduleType) {
			case ViwoodsModuleType.PICKING:
				return await PickingProcessor.processNonNoteFile(
					fileData,
					originalPath,
					metadata,
					moduleConfig as PickingModuleConfig,
					context
				);

			// Future: Add handlers for other modules if they need to process non-.note files
			// case ViwoodsModuleType.LEARNING:
			//   return await LearningProcessor.processNonNoteFile(...);

			default:
				return {
					success: false,
					createdFiles: [],
					warnings: [`${moduleType} module does not support non-.note files yet`],
				};
		}
	}

	validateConfig(config: ProcessorConfig): ValidationResult {
		const viwoodsConfig = config as ViwoodsProcessorConfig;
		const errors: string[] = [];

		// Validate at least one module is enabled
		const anyEnabled = viwoodsConfig.learning.enabled ||
			viwoodsConfig.paper.enabled ||
			viwoodsConfig.daily.enabled ||
			viwoodsConfig.meeting.enabled ||
			viwoodsConfig.picking.enabled ||
			viwoodsConfig.memo.enabled;

		if (!anyEnabled) {
			errors.push("At least one Viwoods module must be enabled");
		}

		// Validate Learning module
		if (viwoodsConfig.learning.enabled) {
			if (!viwoodsConfig.learning.highlightsFolder && !viwoodsConfig.learning.annotationsFolder) {
				errors.push("Learning module: At least one output folder must be specified");
			}
		}

		// Validate Paper module
		if (viwoodsConfig.paper.enabled) {
			if (!viwoodsConfig.paper.notesFolder) {
				errors.push("Paper module: notesFolder must be specified");
			}
		}

		return {
			valid: errors.length === 0,
			errors: errors.length > 0 ? errors : undefined,
		};
	}

	getDefaultConfig(): ViwoodsProcessorConfig {
		return {
			learning: {
				enabled: true,
				outputFolder: "Viwoods/Learning",
				highlightsFolder: "Viwoods/Learning/Highlights",
				annotationsFolder: "Viwoods/Learning/Annotations",
				sourcesFolder: "Viwoods/Learning/Library",
				includeMetadata: true,
				includeThumbnail: true,
				extractImages: true,
				processAnnotations: true,
				annotationImagesFolder: "Viwoods/Learning/Annotations/resources",
				includeSummaryInAnnotation: true,
				createCompositeImages: true,
				downloadSourceFiles: true,
			},
			paper: {
				enabled: true,
				outputFolder: "Viwoods/Paper",
				notesFolder: "Viwoods/Paper",
				includeMetadata: true,
				includeThumbnail: true,
				extractImages: true,
				preserveFolderStructure: true,
			},
			daily: {
				enabled: false,
				outputFolder: "Viwoods/Daily",
				dailyNotesFolder: "Viwoods/Daily",
				dateFormat: "YYYY-MM-DD",
				includeMetadata: true,
				includeThumbnail: true,
				extractImages: true,
			},
			meeting: {
				enabled: false,
				outputFolder: "Viwoods/Meeting",
				meetingsFolder: "Viwoods/Meeting/Notes",
				pagesFolder: "Viwoods/Meeting/Pages",
				resourcesFolder: "Viwoods/Meeting/Resources",
				includeMetadata: true,
				includeThumbnail: true,
				extractImages: true,
			},
			picking: {
				enabled: false,
				outputFolder: "Viwoods/Picking",
				capturesFolder: "Viwoods/Picking/Captures",
				resourcesFolder: "Viwoods/Picking/Resources",
				includeMetadata: true,
				includeThumbnail: true,
				extractImages: true,
			},
			memo: {
				enabled: false,
				outputFolder: "Viwoods/Memo",
				memosFolder: "Viwoods/Memo",
				includeMetadata: true,
				includeThumbnail: true,
				extractImages: true,
			},
		};
	}

	getDefaultTemplates(): Record<string, string> {
		const templates = TemplateDefaults.getAll();
		return {
			// Learning
			highlight: templates["viwoods-highlight.md"] || "",
			annotation: templates["viwoods-annotation.md"] || "",
			epubAnnotation: templates["viwoods-epub-annotation.md"] || "",
			// Paper
			paperNote: templates["viwoods-paper-note.md"] || "",
			paperPage: templates["viwoods-paper-page.md"] || "",
			// Daily
			dailyNote: templates["viwoods-daily-note.md"] || "",
			// Meeting
			meetingNote: templates["viwoods-meeting-note.md"] || "",
			// Picking
			pickingCapture: templates["viwoods-picking-capture.md"] || "",
			// Memo
			memo: templates["viwoods-memo.md"] || "",
			// Legacy
			page: templates["viwoods-page.md"] || "",
		};
	}

	shouldSkipFile(
		filePath: string,
		metadata: FileMetadata,
		config: ProcessorConfig
	): { shouldSkip: boolean; reason?: string } {
		const viwoodsConfig = config as ViwoodsProcessorConfig;
		const pathLower = filePath.toLowerCase();

		// Check template folders
		if (pathLower.includes("/image template/") || pathLower.includes("/pdf template/")) {
			return { shouldSkip: true, reason: "File in template folder" };
		}

		// Check each module folder
		if (pathLower.includes("/learning/") && !viwoodsConfig.learning.enabled) {
			return { shouldSkip: true, reason: "Learning module disabled" };
		}
		if (pathLower.includes("/paper/") && !viwoodsConfig.paper.enabled) {
			return { shouldSkip: true, reason: "Paper module disabled" };
		}
		if (pathLower.includes("/daily/") && !viwoodsConfig.daily.enabled) {
			return { shouldSkip: true, reason: "Daily module disabled" };
		}
		if (pathLower.includes("/meeting/") && !viwoodsConfig.meeting.enabled) {
			return { shouldSkip: true, reason: "Meeting module disabled" };
		}
		if (pathLower.includes("/picking/") && !viwoodsConfig.picking.enabled) {
			return { shouldSkip: true, reason: "Picking module disabled" };
		}
		if (pathLower.includes("/memo/") && !viwoodsConfig.memo.enabled) {
			return { shouldSkip: true, reason: "Memo module disabled" };
		}

		return { shouldSkip: false };
	}

	canHandleFile(
		filePath: string,
		fileExtension: string,
		config: ProcessorConfig
	): boolean {
		const pathLower = filePath.toLowerCase();

		// Check if file is in any Viwoods module folder
		const isInModuleFolder =
			pathLower.includes("/learning/") ||
			pathLower.includes("/paper/") ||
			pathLower.includes("/daily/") ||
			pathLower.includes("/meeting/") ||
			pathLower.includes("/picking/") ||
			pathLower.includes("/memo/");

		if (!isInModuleFolder) {
			return false;
		}

		// Check if extension is supported
		return this.supportedExtensions.includes(fileExtension.toLowerCase());
	}

	getConfigSchema(): ConfigSchema {
		return {
			fields: [
				// Learning Module
				{
					key: "learning.enabled",
					label: "Enable Module",
					description: "Process EPUB/PDF reading notes and annotations",
					type: "boolean",
					defaultValue: true,
					group: "Learning",
				},
				{
					key: "learning.highlightsFolder",
					label: "Highlights Folder",
					description: "Folder for text highlights",
					type: "folder",
					required: false,
					defaultValue: "Viwoods/Learning/Highlights",
					group: "Learning",
					groupToggleKey: "learning.enabled",
				},
				{
					key: "learning.annotationsFolder",
					label: "Annotations Folder",
					description: "Folder for handwritten annotations",
					type: "folder",
					required: false,
					defaultValue: "Viwoods/Learning/Annotations",
					group: "Learning",
					groupToggleKey: "learning.enabled",
				},
				{
					key: "learning.sourcesFolder",
					label: "Sources Folder",
					description: "Folder for original EPUB/PDF files",
					type: "folder",
					required: false,
					defaultValue: "Viwoods/Learning/Library",
					group: "Learning",
					groupToggleKey: "learning.enabled",
				},
				{
					key: "learning.highlightTemplate",
					label: "Highlight Template",
					description: "Custom template for highlights",
					type: "file",
					required: false,
					group: "Learning",
					groupToggleKey: "learning.enabled",
				},
				{
					key: "learning.annotationTemplate",
					label: "Annotation Template",
					description: "Custom template for annotations",
					type: "file",
					required: false,
					group: "Learning",
					groupToggleKey: "learning.enabled",
				},
				{
					key: "learning.processAnnotations",
					label: "Process Annotations",
					description: "Extract and process handwritten annotations",
					type: "boolean",
					defaultValue: true,
					group: "Learning",
					groupToggleKey: "learning.enabled",
				},
				{
					key: "learning.createCompositeImages",
					label: "Create Composite Images",
					description: "Combine page image with annotation overlay",
					type: "boolean",
					defaultValue: true,
					group: "Learning",
					groupToggleKey: "learning.enabled",
				},
				{
					key: "learning.downloadSourceFiles",
					label: "Download Source Files",
					description: "Download source files (.epub, .note) to Sources folder",
					type: "boolean",
					defaultValue: true,
					group: "Learning",
					groupToggleKey: "learning.enabled",
				},

				// Paper Module
				{
					key: "paper.enabled",
					label: "Enable Module",
					description: "Process handwritten notes",
					type: "boolean",
					defaultValue: true,
					group: "Paper",
				},
				{
					key: "paper.notesFolder",
					label: "Notes Folder",
					description: "Folder for note files",
					type: "folder",
					required: false,
					defaultValue: "Viwoods/Paper/Notes",
					group: "Paper",
					groupToggleKey: "paper.enabled",
				},
				{
					key: "paper.noteTemplate",
					label: "Note Template",
					description: "Custom template for note files",
					type: "file",
					required: false,
					group: "Paper",
					groupToggleKey: "paper.enabled",
				},
				{
					key: "paper.preserveFolderStructure",
					label: "Preserve Folder Structure",
					description: "Preserve custom folder organization from Viwoods",
					type: "boolean",
					defaultValue: true,
					group: "Paper",
					groupToggleKey: "paper.enabled",
				},

				// Daily Module
				{
					key: "daily.enabled",
					label: "Enable Module",
					description: "Process daily journal entries",
					type: "boolean",
					defaultValue: false,
					group: "Daily",
				},
				{
					key: "daily.dailyNotesFolder",
					label: "Daily Notes Folder",
					description: "Folder for daily notes",
					type: "folder",
					required: false,
					defaultValue: "Viwoods/Daily",
					group: "Daily",
					groupToggleKey: "daily.enabled",
				},

				// Meeting Module
				{
					key: "meeting.enabled",
					label: "Enable Module",
					description: "Process meeting notes",
					type: "boolean",
					defaultValue: false,
					group: "Meeting",
				},
				{
					key: "meeting.meetingsFolder",
					label: "Meetings Folder",
					description: "Folder for meeting notes",
					type: "folder",
					required: false,
					defaultValue: "Viwoods/Meeting/Notes",
					group: "Meeting",
					groupToggleKey: "meeting.enabled",
				},

				// Picking Module
				{
					key: "picking.enabled",
					label: "Enable Module",
					description: "Process quick captures",
					type: "boolean",
					defaultValue: false,
					group: "Picking",
				},
				{
					key: "picking.capturesFolder",
					label: "Captures Folder",
					description: "Folder for quick captures",
					type: "folder",
					required: false,
					defaultValue: "Viwoods/Picking/Captures",
					group: "Picking",
					groupToggleKey: "picking.enabled",
				},

				// Memo Module
				{
					key: "memo.enabled",
					label: "Enable Module",
					description: "Process text memos (awaiting samples)",
					type: "boolean",
					defaultValue: false,
					group: "Memo",
				},
				{
					key: "memo.memosFolder",
					label: "Memos Folder",
					description: "Folder for memos",
					type: "folder",
					required: false,
					defaultValue: "Viwoods/Memo",
					group: "Memo",
					groupToggleKey: "memo.enabled",
				},
			],
		};
	}
}

// Export types
export * from "./ViwoodsTypes";
