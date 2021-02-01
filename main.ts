import { App, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { createDailyNote } from 'obsidian-daily-notes-interface';


interface ReminderPluginSettings {
	dailyNotesFolder: string;
	defaultWhen: string;
	defaultHeader: string;
}

interface ReminderInterface {
	raw: string;
	content: string;
	when: string;
	moment: object;
}

class Reminder implements ReminderInterface {
	raw: string = '';
	when: string = '';
	content: string = '';
	moment: object = {};

	constructor(raw: string, defaultWhen: string, nldates: any) {
		this.raw = raw;
		this.content = raw.split('@')[0];
		this.when = raw.split('@')[1] || defaultWhen;
		this.moment = nldates.parseDate(this.when);
	}
}

const DEFAULT_SETTINGS: ReminderPluginSettings = {
	dailyNotesFolder: '',
	defaultWhen: 'next week',
	defaultHeader: '### Reminder ###'
}

export default class ReminderPlugin extends Plugin {
	settings: ReminderPluginSettings;

	async onload() {
		let naturalLanguageDates = this.app.plugins.getPlugin('nldates-obsidian');
		if (!naturalLanguageDates) {
			new Notice("The Natural Language Dates plugin was not found. The Reminder plugin requires the Natural Language Dates plugin. Please install it first and make sure it is enabled before using Review.");
		}

		await this.loadSettings();

		this.addCommand({
			id: 'save-reminders',
			name: 'Save reminders',
			callback: () => this.saveReminders()
		});

		this.addSettingTab(new ReminderPluginSettingsTab(this.app, this));

		// this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	isReminder(line: string): boolean {
		const commandKeywords: Array<string> = ['/remind'];
		return commandKeywords.some(c => line.indexOf(c) === 0);
	}

	async saveReminders() {
		const file = this.app.workspace.activeLeaf.view.file;
		this.app.vault.read(file).then((content: string) => {
			const lines = content.split('\n').map(l => l.startsWith('- ') ? l.replace('- ', '') : l);
			const reminders: Array<Reminder> = lines.filter(l => this.isReminder(l)).map(r => new Reminder(r, this.settings.defaultWhen, this.app.plugins.getPlugin('nldates-obsidian')));

			let items = {};
			reminders.forEach(reminder => {
				if (!items[reminder.moment.formattedString]) {
					items[reminder.moment.formattedString] = [];
				}

				items[reminder.moment.formattedString].push(reminder.content);

			});


			Object.keys(items).forEach(async dailyNote => {
				let files = this.app.vault.getFiles();
				const content = items[dailyNote];
				let dailyNoteExists: boolean = false;
				if (files.some(f => f.path.indexOf(dailyNote) > -1)) {
					dailyNoteExists = true;
				}

				if (!dailyNoteExists) {
					await createDailyNote(dailyNote.replace(`${this.settings.dailyNotesFolder}/`, ''));
				}
				let files = this.app.vault.getFiles();
				const dailyNoteFile = files.find(f => f.path.indexOf(dailyNote) > -1);

				this.app.vault.read(dailyNoteFile).then(dailyNoteContent => {
					let newDailyNoteContent: string = dailyNoteContent.replace(this.settings.defaultHeader, `${this.settings.defaultHeader}\n - [ ] ${content.join('\n- [ ] ')}`);
					this.app.vault.modify(dailyNoteFile, newDailyNoteContent);
				});
			});
		});
	}

	onunload() {
		console.log('unloading plugin');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class ReminderPluginSettingsTab extends PluginSettingTab {
	plugin: ReminderPlugin;

	constructor(app: App, plugin: ReminderPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let { containerEl } = this;
		const plugin: any = (this as any).plugin;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'Settings for the remidners plugin.' });

		new Setting(containerEl)
			.setName('Daily note location')
			.setDesc('Set the path to your daily notes. Use the format "folder/subfolder". Do not use leading or trailing slashes "/".')
			.addText((text) =>
				text
					.setPlaceholder('')
					.setValue(plugin.settings.dailyNotesFolder)
					.onChange((value) => {
						console.log("The new daily notes folder:" + value);
						plugin.settings.dailyNotesFolder = value;
						plugin.saveData(plugin.settings);
					}));

		new Setting(containerEl)
			.setName('Header')
			.setDesc('Set the header where you reminders will be added')
			.addText((text) =>
				text
					.setPlaceholder('')
					.setValue(plugin.settings.defaultHeader)
					.onChange((value) => {
						plugin.settings.defaultHeader = value;
						plugin.saveData(plugin.settings);
					}));
	}
}
