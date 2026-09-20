<script lang="ts">
	import { Upload, FileUp, FileText, Check, AlertCircle, X, Sparkles, Star } from 'lucide-svelte';
	import { parseFavoritesJson, type ParseImportResult } from '$lib/localFavorites';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		onImport: (list: Array<{ stop_id: string; stop_name: string }>) => Promise<void>;
		isLocalMode?: boolean;
	}

	let { isOpen, onClose, onImport, isLocalMode = false }: Props = $props();

	let fileInput = $state<HTMLInputElement | null>(null);
	let isDragging = $state(false);
	let fileName = $state<string | null>(null);
	let parseResult = $state<ParseImportResult | null>(null);
	let isImporting = $state(false);

	function resetState() {
		fileName = null;
		parseResult = null;
		isImporting = false;
		if (fileInput) fileInput.value = '';
	}

	function handleClose() {
		resetState();
		onClose();
	}

	function processFile(file: File) {
		fileName = file.name;
		const reader = new FileReader();

		reader.onload = (e) => {
			const text = e.target?.result as string;
			parseResult = parseFavoritesJson(text);
		};

		reader.onerror = () => {
			parseResult = {
				valid: false,
				favorites: [],
				totalFound: 0,
				error: 'Błąd podczas odczytu pliku.'
			};
		};

		reader.readAsText(file);
	}

	function handleFileSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			processFile(target.files[0]);
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
			processFile(e.dataTransfer.files[0]);
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
	}

	async function handleConfirm() {
		if (!parseResult || !parseResult.valid || parseResult.favorites.length === 0) return;

		isImporting = true;
		try {
			await onImport(parseResult.favorites);
			handleClose();
		} finally {
			isImporting = false;
		}
	}
</script>

{#if isOpen}
	<div
		class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
		role="dialog"
		aria-modal="true"
	>
		<div class="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-slate-200">
			<!-- Nagłówek -->
			<div class="flex items-center justify-between border-b border-slate-800 pb-3.5">
				<div class="flex items-center gap-2.5">
					<div class="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
						<FileUp class="w-5 h-5" />
					</div>
					<div>
						<h3 class="font-bold text-white text-base">Import ulubionych przystanków</h3>
						<p class="text-[11px] text-slate-400">
							{isLocalMode ? 'Zapis na tym urządzeniu' : 'Zapis na Twoim koncie'}
						</p>
					</div>
				</div>
				<button
					onclick={handleClose}
					class="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<!-- Strefa wyboru pliku / Drop zone -->
			<input
				type="file"
				accept=".json,application/json"
				bind:this={fileInput}
				onchange={handleFileSelect}
				class="hidden"
			/>

			{#if !parseResult || !parseResult.valid}
				<div
					ondragover={handleDragOver}
					ondragleave={handleDragLeave}
					ondrop={handleDrop}
					role="button"
					tabindex="0"
					onclick={() => fileInput?.click()}
					onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInput?.click(); }}
					class="border-2 border-dashed rounded-2xl p-8 text-center transition cursor-pointer flex flex-col items-center gap-3 {isDragging ? 'border-amber-500 bg-amber-500/10 scale-[1.01]' : 'border-slate-700/80 hover:border-amber-500/60 bg-slate-950/50 hover:bg-slate-950'}"
				>
					<div class="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
						<Upload class="w-6 h-6" />
					</div>
					<div>
						<p class="text-sm font-bold text-white">
							Przeciągnij i upuść plik lub <span class="text-amber-400 underline decoration-amber-400/40">wybierz z dysku</span>
						</p>
						<p class="text-xs text-slate-400 mt-1">
							Obsługiwany format: pliki z listą przystanków (.json)
						</p>
					</div>
				</div>
			{/if}

			<!-- Błąd parsowania -->
			{#if parseResult && !parseResult.valid}
				<div class="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
					<AlertCircle class="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
					<div class="flex-1">
						<p class="font-bold text-rose-200">Nie udało się odczytać pliku</p>
						<p class="text-[11px] mt-0.5">{parseResult.error || 'Nieprawidłowy format pliku.'}</p>
					</div>
					<button
						onclick={() => fileInput?.click()}
						class="px-2 py-1 rounded-lg bg-rose-500/20 text-rose-200 text-[11px] font-semibold hover:bg-rose-500/30 transition cursor-pointer"
					>
						Spróbuj ponownie
					</button>
				</div>
			{/if}

			<!-- Podgląd przystanków przed zatwierdzeniem -->
			{#if parseResult && parseResult.valid}
				<div class="space-y-3">
					<div class="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
						<div class="flex items-center gap-2 text-xs">
							<FileText class="w-4 h-4 text-amber-400" />
							<span class="font-medium text-slate-300 truncate max-w-[200px]">{fileName}</span>
						</div>
						<span class="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold">
							Znaleziono {parseResult.totalFound} {parseResult.totalFound === 1 ? 'przystanek' : (parseResult.totalFound < 5 ? 'przystanki' : 'przystanków')}
						</span>
					</div>

					<div class="text-xs text-slate-400 flex items-center justify-between">
						<span>Podgląd listy do zaimportowania:</span>
						<button
							onclick={() => fileInput?.click()}
							class="text-[11px] text-amber-400 hover:underline cursor-pointer"
						>
							Wybierz inny plik
						</button>
					</div>

					<div class="max-h-56 overflow-y-auto divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950/80 p-1">
						{#each parseResult.favorites as stop}
							<div class="p-2.5 flex items-center justify-between text-xs">
								<div class="flex items-center gap-2 min-w-0">
									<Star class="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
									<span class="font-semibold text-white truncate">{stop.stop_name}</span>
								</div>
								<span class="text-[10px] text-slate-500 font-mono-board shrink-0 ml-2">ID: {stop.stop_id}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Stopka akcji -->
			<div class="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
				<button
					type="button"
					onclick={handleClose}
					disabled={isImporting}
					class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:text-white transition cursor-pointer"
				>
					Anuluj
				</button>
				{#if parseResult && parseResult.valid}
					<button
						type="button"
						onclick={handleConfirm}
						disabled={isImporting}
						class="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer disabled:opacity-50"
					>
						<Check class="w-4 h-4" />
						<span>{isImporting ? 'Importowanie...' : `Zatwierdź i importuj (${parseResult.totalFound})`}</span>
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
