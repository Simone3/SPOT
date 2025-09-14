import '@fontsource/inter/300.css';
import '@fontsource/inter/700.css';
import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router';
import TasksPage from './components/tasks/TasksPage';
import NotesPage from './components/notes/NotesPage';
import Sidebar from './components/common/Sidebar';
import MainContent from './components/common/MainContent';
import TagsPage from './components/tags/TagsPage';
import SettingsPage from './components/settings/SettingsPage';
import { DatesContextProvider } from './contexts/DatesContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
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
