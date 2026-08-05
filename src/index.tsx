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
import { BackupLocationContextProvider } from 'src/contexts/BackupLocationContext';
import { DatesContextProvider } from 'src/contexts/DatesContext';
import { TasksContextProvider } from 'src/contexts/TasksContext';
import { installPendingTaskChangesFlushHandler } from 'src/logic/PendingTaskChanges';

// Saves buffered task changes when the window closes and when the main process asks for them, for the whole lifetime of the renderer
installPendingTaskChangesFlushHandler();

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
	<React.StrictMode>
		<DatesContextProvider>
			<BackupLocationContextProvider>
				<TasksContextProvider>
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
				</TasksContextProvider>
			</BackupLocationContextProvider>
		</DatesContextProvider>
	</React.StrictMode>
);
