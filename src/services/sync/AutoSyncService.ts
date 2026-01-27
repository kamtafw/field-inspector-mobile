import { Q } from "@nozbe/watermelondb"
import { Subscription } from "rxjs"
import database from "@/src/database"
import SyncEngine from "./SyncEngine"
import PhotoUploadService from "../photo/PhotoUploadService"
import Inspection from "@/src/database/models/Inspection"
import Photo from "@/src/database/models/Photo"
import NetworkMonitor from "../network/NetworkMonitor"
import InspectionRepository from "@/src/database/repositories/InspectionRepository"
import PhotoRepository from "@/src/database/repositories/PhotoRepository"

/**
 * Global listener that automatically triggers sync when inspections are created/updated
 */
class AutoSyncService {
	private isInitialized = false
	private checkInterval?: NodeJS.Timeout
	private networkUnsubscribe?: () => void

	async initialize() {
		if (this.isInitialized) {
			console.log("⚠️ AutoSyncService already initialized")
			return
		}

		// check for pending work every 10 seconds
		this.startPolling()

		// listen for network coming back online
		this.setupNetworkListener()

		// initial check on startup
		this.checkAndSync()

		this.isInitialized = true
		console.log("✅ AutoSyncService initialized")
	}

	/** Poll for pending work every 5 seconds */
	private startPolling() {
		this.checkInterval = setInterval(() => this.checkAndSync(), 5000)
	}

	/** Listen for network changes */
	private setupNetworkListener() {
		this.networkUnsubscribe = NetworkMonitor.addListener((status) => {
			if (status === "online") {
				console.log("🌐 Network back online, checking for pending work...")
				setTimeout(() => this.checkAndSync(), 1000)
			}
		})
	}

	/** Check if there's work to do and trigger sync */
	private async checkAndSync() {
		try {
			if (!NetworkMonitor.isOnline()) {
				return
			}

			const unsyncedInspections = await InspectionRepository.getUnsynced()

			const pendingPhotos = await PhotoRepository.getPendingUploads()

			if (unsyncedInspections.length > 0) {
				console.log("🔄 Triggering inspection sync...")
				SyncEngine.processQueue().catch((err) => {
					console.error("Auto-sync failed:", err)
				})
			}

			if (pendingPhotos.length > 0) {
				console.log("🔄 Triggering photo upload...")
				PhotoUploadService.processQueue().catch((err) => {
					console.error("Auto photo upload failed:", err)
				})
			}
		} catch (err) {
			console.error("Error in checkAndSync:", err)
		}
	}

	/** Cleanup */
	cleanup() {
		if (this.checkInterval) {
			clearInterval(this.checkInterval)
		}
		if (this.networkUnsubscribe) {
			this.networkUnsubscribe()
		}
	}

	/** Manual trigger (for pull-to-refresh) */
	async syncNow() {
		await SyncEngine.processQueue()
		await PhotoUploadService.processQueue()
	}
}

export default new AutoSyncService()
