import '@fontsource/inter/300.css';
import '@fontsource/inter/700.css';
import 'src/index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router';
import { TasksPage } from 'src/components/tasks/TasksPage';
import { NotesPage } from 'src/components/notes/NotesPage';
import { Sidebar } from 'src/components/common/Sidebar';
import { MainContent } from 'src/components/common/MainContent';
import { TagsPage } from 'src/components/tags/TagsPage';
import { SettingsPage } from 'src/components/settings/SettingsPage';
import { DatabaseLocationGate } from 'src/components/storage/DatabaseLocationGate';
import { DatabaseLocationContextProvider } from 'src/contexts/DatabaseLocationContext';
import { DatesContextProvider } from 'src/contexts/DatesContext';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
	<React.StrictMode>
		<DatesContextProvider>
			<DatabaseLocationContextProvider>
				<DatabaseLocationGate>
					<HashRouter>
						<Sidebar/>
						<MainContent>
							<Routes>
								<Route path='/' element={<TasksPage/>}/>
								<Route path='/notes' element={<NotesPage/>}/>
								<Route path='/tags' element={<TagsPage/>}/>
								<Route path='/settings' element={<SettingsPage/>}/>
							</Routes>
						</MainContent>
					</HashRouter>
				</DatabaseLocationGate>
			</DatabaseLocationContextProvider>
		</DatesContextProvider>
	</React.StrictMode>
);
