import * as FileSystem from "expo-file-system/legacy"

export interface StorageCheckResult {
	hasEnoughSpace: boolean
	freeSpaceMB: number
	requiredMB: number
	freeSpaceLabel: string // e.g. "18 MB"
}

/** Minimum free space required before saving a new inspection (5 MB). */
const INSPECTION_MIN_BYTES = 5 * 1024 * 1024

/** Minimum free space required before saving a photo record (20 MB). */
const PHOTO_MIN_BYTES = 20 * 1024 * 1024

/** Check whether there is enough space to write a new inspection. */
export async function checkStorageForInspection(): Promise<StorageCheckResult> {
	return checkStorage(INSPECTION_MIN_BYTES)
}

/** Check whether there is enough space to write a new photo record. */
export async function checkStorageForPhoto(): Promise<StorageCheckResult> {
	return checkStorage(PHOTO_MIN_BYTES)
}

async function checkStorage(requiredBytes: number): Promise<StorageCheckResult> {
	const freeBytes = await FileSystem.getFreeDiskStorageAsync()
	const freeSpaceMB = freeBytes / (1024 * 1024)
	const requiredMB = requiredBytes / (1024 * 1024)

	return {
		hasEnoughSpace: freeBytes >= requiredBytes,
		freeSpaceMB,
		requiredMB,
		freeSpaceLabel: formatMB(freeSpaceMB),
	}
}

/** Format a megabyte value for display, e.g. "18 MB" or "1.2 GB". */
function formatMB(mb: number): string {
	if (mb >= 1024) {
		return `${(mb / 1024).toFixed(1)} GB`
	}
	return `${mb.toFixed(0)} MB`
}

/**
 * Detect whether a caught error originated from a full-disk / storage-quota
 * condition inside WatermelonDB / SQLite. These errors don't have a clean type;
 * we pattern-match on the message string.
 */
export function isStorageFullError(error: any): boolean {
	const msg: string = (error?.message ?? "").toLowerCase()
	return (
		msg.includes("no space left") ||
		msg.includes("disk full") ||
		msg.includes("database is full") ||
		msg.includes("enospc") ||
		msg.includes("storage") ||
		msg.includes("quota")
	)
}
