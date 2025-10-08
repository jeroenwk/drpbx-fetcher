import { FileProcessor } from "./types";
import { FileTypeMapping } from "../models/Settings";

/**
 * Singleton registry for managing file processors
 */
export class ProcessorRegistry {
	private static instance: ProcessorRegistry;
	private processors: Map<string, FileProcessor>;

	private constructor() {
		this.processors = new Map();
	}

	/**
	 * Get the singleton instance
	 */
	static getInstance(): ProcessorRegistry {
		if (!ProcessorRegistry.instance) {
			ProcessorRegistry.instance = new ProcessorRegistry();
		}
		return ProcessorRegistry.instance;
	}

	/**
	 * Register a processor
	 * @param processor Processor to register
	 */
	register(processor: FileProcessor): void {
		if (this.processors.has(processor.type)) {
			console.warn(`Processor ${processor.type} is already registered. Overwriting.`);
		}
		this.processors.set(processor.type, processor);
		console.log(`Registered processor: ${processor.name} (${processor.type})`);
	}

	/**
	 * Get a processor by type
	 * @param type Processor type identifier
	 * @returns Processor or null if not found
	 */
	getByType(type: string): FileProcessor | null {
		return this.processors.get(type) || null;
	}

	/**
	 * Get a processor by file extension
	 * @param extension File extension (without dot)
	 * @param mappings File type mappings from settings
	 * @returns Processor or null if no enabled mapping found
	 */
	getByExtension(extension: string, mappings: FileTypeMapping[]): FileProcessor | null {
		// Find enabled mapping for this extension
		const mapping = mappings.find(
			(m) => m.extension.toLowerCase() === extension.toLowerCase() && m.enabled
		);

		if (!mapping) {
			return null;
		}

		return this.getByType(mapping.processorType);
	}

	/**
	 * Get all registered processors
	 * @returns Array of all processors
	 */
	listAll(): FileProcessor[] {
		return Array.from(this.processors.values());
	}

	/**
	 * Check if a processor is registered
	 * @param type Processor type identifier
	 * @returns True if processor is registered
	 */
	has(type: string): boolean {
		return this.processors.has(type);
	}

	/**
	 * Unregister a processor
	 * @param type Processor type identifier
	 */
	unregister(type: string): void {
		this.processors.delete(type);
	}

	/**
	 * Clear all registered processors
	 */
	clear(): void {
		this.processors.clear();
	}
}
