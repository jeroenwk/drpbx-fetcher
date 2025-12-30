import { moment } from "obsidian";

/**
 * Date module for Templater
 * Provides date and time manipulation functions
 */
export class DateModule {
	/**
	 * Get current date/time with optional formatting and offset
	 * @param format Moment.js format string (default: "YYYY-MM-DD")
	 * @param offset Offset in days (number) or ISO 8601 duration string (e.g., "P1Y", "P-1M", "P1W")
	 * @param reference Reference date to use instead of now
	 * @param referenceFormat Format of the reference date
	 * @returns Formatted date string
	 *
	 * Examples:
	 * - tp.date.now() → "2025-12-30"
	 * - tp.date.now("YYYY-MM-DD HH:mm") → "2025-12-30 14:30"
	 * - tp.date.now("YYYY-MM-DD", 7) → "2026-01-06" (7 days from now)
	 * - tp.date.now("YYYY-MM-DD", -7) → "2025-12-23" (7 days ago)
	 * - tp.date.now("YYYY-MM-DD", "P1Y") → "2026-12-30" (1 year from now)
	 * - tp.date.now("YYYY-MM-DD", "P-1M") → "2025-11-30" (1 month ago)
	 */
	now(
		format?: string,
		offset?: number | string,
		reference?: string | Date,
		referenceFormat?: string
	): string {
		// Use reference date if provided, otherwise use current date
		let date = reference
			? moment(reference, referenceFormat)
			: moment();

		// Apply offset if provided
		if (offset !== undefined && offset !== null) {
			if (typeof offset === "number") {
				// Numeric offset: days
				date = date.add(offset, "days");
			} else if (typeof offset === "string") {
				// ISO 8601 duration string (e.g., "P1Y", "P-1M", "P1W")
				// moment.duration can parse ISO 8601 durations
				const duration = moment.duration(offset);
				date = date.add(duration);
			}
		}

		// Apply format if provided, otherwise use default
		const formatString = format || "YYYY-MM-DD";
		return date.format(formatString);
	}

	/**
	 * Get tomorrow's date
	 * @param format Moment.js format string (default: "YYYY-MM-DD")
	 * @returns Formatted date string for tomorrow
	 *
	 * Example:
	 * - tp.date.tomorrow() → "2025-12-31"
	 * - tp.date.tomorrow("dddd, MMMM DD YYYY") → "Wednesday, December 31 2025"
	 */
	tomorrow(format?: string): string {
		return this.now(format, 1);
	}

	/**
	 * Get yesterday's date
	 * @param format Moment.js format string (default: "YYYY-MM-DD")
	 * @returns Formatted date string for yesterday
	 *
	 * Example:
	 * - tp.date.yesterday() → "2025-12-29"
	 */
	yesterday(format?: string): string {
		return this.now(format, -1);
	}

	/**
	 * Get a specific weekday relative to a reference date
	 * @param format Moment.js format string (default: "YYYY-MM-DD")
	 * @param weekday Day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
	 * @param reference Reference date (default: today)
	 * @param referenceFormat Format of reference date
	 * @returns Formatted date string for the specified weekday
	 *
	 * Examples:
	 * - tp.date.weekday("YYYY-MM-DD", 0) → Next Sunday
	 * - tp.date.weekday("YYYY-MM-DD", 1) → Next Monday
	 * - tp.date.weekday("YYYY-MM-DD", 6) → Next Saturday
	 */
	weekday(
		format?: string,
		weekday?: number,
		reference?: string | Date,
		referenceFormat?: string
	): string {
		// Use reference date if provided, otherwise use current date
		const date = reference
			? moment(reference, referenceFormat)
			: moment();

		// Default to Monday (1) if weekday not specified
		const targetWeekday = weekday !== undefined ? weekday : 1;

		// Get current day of week (0-6)
		const currentWeekday = date.day();

		// Calculate days to add to get to target weekday
		let daysToAdd = targetWeekday - currentWeekday;

		// If target weekday is today or in the past this week, go to next week
		if (daysToAdd <= 0) {
			daysToAdd += 7;
		}

		// Add days to get to target weekday
		const targetDate = date.add(daysToAdd, "days");

		// Apply format if provided, otherwise use default
		const formatString = format || "YYYY-MM-DD";
		return targetDate.format(formatString);
	}
}
