import fs from 'fs';

// Ładowanie zmiennych środowiskowych z .env w Node.js
if (fs.existsSync('.env')) {
	try {
		process.loadEnvFile?.('.env');
	} catch {
		// loadEnvFile jest dostępne od Node.js 20.6.0+
	}
}

const { syncGtfsData, GTFS_ZIP_URL } = await import('../src/lib/server/gtfs.ts');

console.log(`=== Rozpoczynanie synchronizacji GTFS z ${GTFS_ZIP_URL} ===`);

const result = await syncGtfsData((msg) => console.log(msg));

if (result.success) {
	console.log('\n=== SUKCES! ===');
	console.log(`Liczba linii: ${result.routesCount}`);
	console.log(`Liczba przystanków: ${result.stopsCount}`);
	console.log(`Liczba tras (stop_times): ${result.trasyCount}`);
	console.log(`Czas wykonania: ${(result.durationMs / 1000).toFixed(2)}s`);
	process.exit(0);
} else {
	console.error('\n=== BŁĄD! ===');
	console.error(result.error);
	process.exit(1);
}
