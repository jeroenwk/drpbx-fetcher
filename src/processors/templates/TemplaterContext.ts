import { App, Vault } from "obsidian";
import * as Obsidian from "obsidian";
import { DateModule } from "./modules/DateModule";
import { FileModule } from "./modules/FileModule";
import { FrontmatterModule } from "./modules/FrontmatterModule";
import { ConfigModule } from "./modules/ConfigModule";
import type { ProcessorContext } from "../types";

/**
 * The tp object provided to templates
 * Contains all Templater modules and functions
 */
export interface TemplaterAPI {
	/** Date and time functions */
	date: DateModule;

	/** File operations and metadata */
	file: FileModule;

	/** Frontmatter property access */
	frontmatter: Record<string, unknown>;

	/** Direct access to Obsidian App API */
	app: App;

	/** Full Obsidian API namespace */
	obsidian: typeof Obsidian;

	/** Template execution configuration */
	config: ConfigModule;

	/** Custom variables from template render call */
	user: Record<string, unknown>;
}

/**
 * Context for template execution
 * Contains the tp object and all necessary data for rendering
 */
export interface TemplaterContext {
	/** The tp object available to template code */
	tp: TemplaterAPI;

	/** Raw variables passed to render() */
	variables: Record<string, unknown>;

	/** Vault instance */
	vault: Vault;

	/** App instance */
	app: App;
}

/**
 * Build a Templater execution context from processor context and variables
 */
export class TemplaterContextBuilder {
	/**
	 * Build a complete TemplaterContext for template execution
	 * @param processorContext Processor context with vault, app, etc.
	 * @param variables Custom variables to pass to template
	 * @param metadata Optional file metadata (path, content, dates)
	 * @returns Complete TemplaterContext ready for template execution
	 */
	static build(
		processorContext: ProcessorContext,
		variables: Record<string, unknown>,
		metadata?: {
			filePath?: string;
			content?: string;
			createTime?: Date;
			modifiedTime?: Date;
		}
	): TemplaterContext {
		const { vault, app } = processorContext;

		// Create module instances
		const dateModule = new DateModule();
		const fileModule = new FileModule(vault, app, metadata);
		const configModule = new ConfigModule({
			activeFile: metadata?.filePath,
			runMode: "batch"
		});

		// Create frontmatter proxy
		const frontmatter = FrontmatterModule.createProxy(
			metadata?.content,
			variables
		);

		// Build the tp object
		const tp: TemplaterAPI = {
			date: dateModule,
			file: fileModule,
			frontmatter: frontmatter,
			app: app,
			obsidian: Obsidian,
			config: configModule,
			user: variables
		};

		// Return complete context
		return {
			tp,
			variables,
			vault,
			app
		};
	}
}
