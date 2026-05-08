import '@fontsource/inter/300.css';
import '@fontsource/inter/700.css';
import 'src/index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router';
import TasksPage from 'src/components/tasks/TasksPage';
import NotesPage from 'src/components/notes/NotesPage';
import Sidebar from 'src/components/common/Sidebar';
import MainContent from 'src/components/common/MainContent';
import TagsPage from 'src/components/tags/TagsPage';
import SettingsPage from 'src/components/settings/SettingsPage';
import { DatesContextProvider } from 'src/contexts/DatesContext';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
	<React.StrictMode>
		<DatesContextProvider>
			<BrowserRouter>
				<Sidebar/>
				<MainContent>
					<Routes>
						<Route path='/' element={<TasksPage/>}/>
						<Route path='/notes' element={<NotesPage/>}/>
						<Route path='/tags' element={<TagsPage/>}/>
						<Route path='/settings' element={<SettingsPage/>}/>
					</Routes>
				</MainContent>
			</BrowserRouter>
		</DatesContextProvider>
	</React.StrictMode>
);
