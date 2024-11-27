import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router';
import './index.css';
import TasksPage from './components/tasks/TasksPage';
import NotesPage from './components/notes/NotesPage';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
	<React.StrictMode>
		<BrowserRouter>
			<Routes>
				<Route path='/' element={<TasksPage/>}/>
				<Route path='/notes' element={<NotesPage/>}/>
			</Routes>
		</BrowserRouter>
	</React.StrictMode>
);
