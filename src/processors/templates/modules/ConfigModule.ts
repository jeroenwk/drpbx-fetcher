/**
 * Config module for Templater
 * Provides access to template execution metadata
 */
export class ConfigModule {
	/** Path to the template file being processed */
	template_file?: string;

	/** Path to the file being created/modified */
	active_file?: string;

	/** Execution mode (e.g., "batch", "manual") */
	run_mode: string;

	constructor(metadata?: {
		templateFile?: string;
		activeFile?: string;
		runMode?: string;
	}) {
		this.template_file = metadata?.templateFile;
		this.active_file = metadata?.activeFile;
		this.run_mode = metadata?.runMode || "batch";
	}
}
