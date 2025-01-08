import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router';
import TasksPage from './components/tasks/TasksPage';
import NotesPage from './components/notes/NotesPage';
import Sidebar from './components/common/Sidebar';
import MainContent from './components/common/MainContent';
import { ClickOutsideContextProvider } from './contexts/ClickOutsideContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
	<React.StrictMode>
		<ClickOutsideContextProvider>
			<BrowserRouter>
				<Sidebar/>
				<MainContent>
					<Routes>
						<Route path='/' element={<TasksPage/>}/>
						<Route path='/notes' element={<NotesPage/>}/>
					</Routes>
				</MainContent>
			</BrowserRouter>
		</ClickOutsideContextProvider>
	</React.StrictMode>
);
