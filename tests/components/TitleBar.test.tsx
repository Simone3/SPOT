import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithTranslations } from '../testUtils';
import { TitleBar } from 'src/components/common/TitleBar';
import { SPOT_MENU_COMMANDS, type SpotAppMenuApi, type SpotMenu } from 'src/types/AppMenuTypes';

const originalAppMenuApi = window.spotAppMenu;

const MENUS: SpotMenu[] = [
	{
		id: 'file',
		label: 'File',
		items: [{ type: 'entry', command: SPOT_MENU_COMMANDS.exit, label: 'Exit' }]
	},
	{
		id: 'edit',
		label: 'Edit',
		items: [
			{ type: 'entry', command: SPOT_MENU_COMMANDS.copy, label: 'Copy', accelerator: 'Ctrl+C' },
			{ type: 'separator' },
			{ type: 'entry', command: SPOT_MENU_COMMANDS.paste, label: 'Paste', accelerator: 'Ctrl+V' }
		]
	}
];

const setAppMenuApi = (value: unknown): void => {
	Object.defineProperty(window, 'spotAppMenu', {
		configurable: true,
		writable: true,
		value
	});
};

const mockAppMenuApi = (menus: SpotMenu[]): SpotAppMenuApi => {
	const appMenuApi: SpotAppMenuApi = {
		getMenuBar: vi.fn(async() => {
			return menus;
		}),
		runMenuCommand: vi.fn(async() => {
			return undefined;
		})
	};
	setAppMenuApi(appMenuApi);

	return appMenuApi;
};

const openFirstMenu = async(user: ReturnType<typeof userEvent.setup>): Promise<void> => {
	await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));
};

describe('TitleBar', () => {
	afterEach(() => {
		setAppMenuApi(originalAppMenuApi);
		vi.restoreAllMocks();
	});

	// Every platform that keeps a native menu bar answers with nothing, and a second menu bar drawn under the real one would be a bug
	test('draws nothing when the main process offers no menu', async() => {
		const appMenuApi = mockAppMenuApi([]);

		const { container } = renderWithTranslations(<TitleBar/>);

		await waitFor(() => {
			expect(appMenuApi.getMenuBar).toHaveBeenCalled();
		});

		expect(container).toBeEmptyDOMElement();
	});

	test('shows the submenu titles the main process sent', async() => {
		mockAppMenuApi(MENUS);

		renderWithTranslations(<TitleBar/>);

		expect(await screen.findByRole('menuitem', { name: 'File' })).toBeInTheDocument();
		expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();
	});

	test('opens a submenu and runs the entry that was picked', async() => {
		const user = userEvent.setup();
		const appMenuApi = mockAppMenuApi(MENUS);

		renderWithTranslations(<TitleBar/>);
		await openFirstMenu(user);

		expect(screen.getByRole('menuitem', { name: /Paste/ })).toBeInTheDocument();

		await user.click(screen.getByRole('menuitem', { name: /Copy/ }));

		expect(appMenuApi.runMenuCommand).toHaveBeenCalledWith(SPOT_MENU_COMMANDS.copy);
		expect(screen.queryByRole('menuitem', { name: /Paste/ })).not.toBeInTheDocument();
	});

	test('shows the shortcut of an entry that has one', async() => {
		const user = userEvent.setup();
		mockAppMenuApi(MENUS);

		renderWithTranslations(<TitleBar/>);
		await openFirstMenu(user);

		expect(screen.getByText('Ctrl+C')).toBeInTheDocument();
	});

	// The editing entries act on what the user was typing in, which a menu that took the focus would have taken the selection from
	test('leaves the focus where it was', async() => {
		const user = userEvent.setup();
		mockAppMenuApi(MENUS);

		renderWithTranslations(
			<>
				<input aria-label='Task content'/>
				<TitleBar/>
			</>
		);

		const input = screen.getByLabelText('Task content');
		await user.click(input);
		await openFirstMenu(user);

		expect(document.activeElement).toBe(input);

		await user.click(screen.getByRole('menuitem', { name: /Copy/ }));

		expect(document.activeElement).toBe(input);
	});

	test('closes an open submenu on Escape', async() => {
		const user = userEvent.setup();
		mockAppMenuApi(MENUS);

		renderWithTranslations(<TitleBar/>);
		await openFirstMenu(user);

		await user.keyboard('{Escape}');

		expect(screen.queryByRole('menuitem', { name: /Copy/ })).not.toBeInTheDocument();
	});

	test('closes an open submenu when something else is clicked', async() => {
		const user = userEvent.setup();
		mockAppMenuApi(MENUS);

		renderWithTranslations(
			<>
				<button type='button'>Somewhere else</button>
				<TitleBar/>
			</>
		);
		await openFirstMenu(user);

		await user.click(screen.getByRole('button', { name: 'Somewhere else' }));

		expect(screen.queryByRole('menuitem', { name: /Copy/ })).not.toBeInTheDocument();
	});

	// A menu bar is walked with the arrow keys, and the separators are not entries the keyboard can stop on
	test('walks the entries with the keyboard and runs the one it is on', async() => {
		const user = userEvent.setup();
		const appMenuApi = mockAppMenuApi(MENUS);

		renderWithTranslations(<TitleBar/>);
		await openFirstMenu(user);

		await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

		expect(appMenuApi.runMenuCommand).toHaveBeenCalledWith(SPOT_MENU_COMMANDS.paste);
	});

	// Nothing is highlighted while the menu has only just been opened, and a step up from there is the last entry and not the one before it
	test('walks the entries backwards from the end', async() => {
		const user = userEvent.setup();
		const appMenuApi = mockAppMenuApi(MENUS);

		renderWithTranslations(<TitleBar/>);
		await openFirstMenu(user);

		await user.keyboard('{ArrowUp}{Enter}');

		expect(appMenuApi.runMenuCommand).toHaveBeenCalledWith(SPOT_MENU_COMMANDS.paste);
	});

	test('moves to the next submenu with the arrow keys', async() => {
		const user = userEvent.setup();
		mockAppMenuApi(MENUS);

		renderWithTranslations(<TitleBar/>);
		await openFirstMenu(user);

		await user.keyboard('{ArrowRight}');

		expect(screen.getByRole('menuitem', { name: 'Exit' })).toBeInTheDocument();
		expect(screen.queryByRole('menuitem', { name: /Copy/ })).not.toBeInTheDocument();
	});
});
