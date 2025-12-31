/**
 * TypeScript declarations for importing non-code files
 */

// Allow importing .md files as text strings
declare module "*.md" {
	const content: string;
	export default content;
}
