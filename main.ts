import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

let PythonShell: any;
try {
	const pythonShellModule = require('python-shell');
	PythonShell = pythonShellModule.PythonShell;
} catch (error) {
	console.error('Error loading python-shell:', error);
}

interface MyPluginSettings {
	mySetting: string;
	deepgramApiKey: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default',
	deepgramApiKey: ''
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice!');
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));

		// Añadimos un comando para transcribir audio
		this.addCommand({
			id: 'transcribe-audio',
			name: 'Transcribir archivo de audio',
			callback: async () => {
				if (!PythonShell) {
					new Notice('Error: PythonShell no está disponible');
					return;
				}
				
				const fileInput = document.createElement('input');
				fileInput.type = 'file';
				fileInput.accept = '.wav';
				
				fileInput.onchange = async (e: Event) => {
					const target = e.target as HTMLInputElement;
					if (target.files && target.files.length > 0) {
						const file = target.files[0];
						await this.transcribeAndCreateNote(file);
					}
				};
				
				fileInput.click();
			}
		});
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async transcribeAndCreateNote(file: File) {
		try {
			if (!PythonShell) {
				throw new Error('PythonShell no está disponible');
			}

			new Notice('Transcribiendo audio...');
			
			// Importar módulos necesarios
			const path = require('path');
			const os = require('os');
			const fs = require('fs');
			
			// Configurar rutas base
			const pluginRoot = path.join(
				this.app.vault.adapter.basePath,
				'.obsidian',
				'plugins',
				'obsidian-sample-juan'
			);
			
			// Configurar opciones ANTES de usarlas
			const options = {
				mode: 'text',
				pythonPath: path.join(pluginRoot, 'venv', 'Scripts', 'python.exe'),
				pythonOptions: ['-u'],
				scriptPath: path.join(pluginRoot, 'scripts'),
				args: [path.join(os.tmpdir(), file.name)],
				cwd: pluginRoot
			};
			
			// Preparar el archivo
			const arrayBuffer = await file.arrayBuffer();
			const buffer = Buffer.from(new Uint8Array(arrayBuffer));
			
			// Verificar rutas
			console.log('Plugin Root:', pluginRoot);
			console.log('Python Path:', options.pythonPath);
			console.log('Script Path:', options.scriptPath);
			console.log('Python existe:', fs.existsSync(options.pythonPath));
			console.log('Script existe:', fs.existsSync(path.join(options.scriptPath, 'transcripcion_deepgram.py')));
			
			// Escribir archivo temporal
			await fs.promises.writeFile(options.args[0], buffer);
			console.log('Archivo temporal creado en:', options.args[0]);
			
			// Ejecutar transcripción
			const result = await new Promise((resolve, reject) => {
				const pyshell = new PythonShell('transcripcion_deepgram.py', options);
				let transcripcionData = '';
				
				pyshell.on('message', function (message) {
					if (message.trim().startsWith('{')) {
						transcripcionData = message;
					}
				});

				pyshell.on('stderr', function (stderr) {
					console.error('Python stderr:', stderr);
				});

				pyshell.end(function (err, code, signal) {
					if (err || !transcripcionData) {
						reject(err || new Error('No se recibieron datos de transcripción'));
						return;
					}
					resolve(transcripcionData);
				});
			});

			const transcripcionData = JSON.parse(result as string);
			
			if (transcripcionData.error) {
				throw new Error(transcripcionData.error);
			}

			// Crear estructura de carpetas
			const fecha = new Date();
			const carpetaBase = 'Transcripciones';
			const carpetaAnio = `${carpetaBase}/${fecha.getFullYear()}`;
			const carpetaMes = `${carpetaAnio}/${(fecha.getMonth() + 1).toString().padStart(2, '0')}`;
			
			// Crear carpetas si no existen
			for (const carpeta of [carpetaBase, carpetaAnio, carpetaMes]) {
				if (!await this.app.vault.adapter.exists(carpeta)) {
					await this.app.vault.createFolder(carpeta);
				}
			}
			
			// Generar nombre de archivo con estructura de carpetas
			const fechaFormateada = fecha.toISOString().split('T')[0];
			const hora = fecha.toTimeString().split(' ')[0].replace(/:/g, '-');
			const fileName = `${carpetaMes}/${fechaFormateada}-${hora}-${file.name.replace('.wav', '')}.md`;
			
			// Crear contenido de la nota
			const content = `---
created: ${fecha.toISOString()}
type: transcription
audio_file: "${file.name}"
duration: "${Math.floor(transcripcionData.metadata?.duracion_total || 0)}s"
speakers: ${transcripcionData.metadata.num_hablantes}
language: "${transcripcionData.idioma_detectado}"
---

# Transcripción: ${file.name}

## Metadata
- **Fecha**: ${fechaFormateada}
- **Hora**: ${hora}
- **Duración**: ${Math.floor(transcripcionData.metadata?.duracion_total || 0)} segundos
- **Número de Hablantes**: ${transcripcionData.metadata.num_hablantes}
- **Idioma**: ${transcripcionData.idioma_detectado}

## Conversación
${transcripcionData.conversacion_formateada || 'No se pudo procesar la conversación'}
`;
			
			// Crear nota
			await this.app.vault.create(fileName, content);
			new Notice(`Transcripción guardada en ${fileName}`);
			
			// Limpiar
			await fs.promises.unlink(options.args[0]);

		} catch (error) {
			console.error('Error detallado en transcripción:', error);
			console.error('Stack trace:', error.stack);
			new Notice('Error al transcribir el audio');
		}
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Deepgram API Key')
			.setDesc('Ingresa tu API key de Deepgram')
			.addText(text => text
				.setPlaceholder('API Key')
				.setValue(this.plugin.settings.deepgramApiKey)
				.onChange(async (value) => {
					this.plugin.settings.deepgramApiKey = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
