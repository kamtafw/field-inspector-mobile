class SyncService {
	private static paused = false

	static pause() {
		this.paused = true
		// stop any running sync timers/jobs
	}

	static resume() {
		this.paused = false
		this.syncPending()
	}

	private static async syncPending() {
		if (this.paused) return
		// fetch all pending_sync inspections for current user
		// attempt to sync each to server
		// update status on success/failure
	}
}
