import './Header.css';
import Clickable from './Clickable';

const Header = ({ title, actions }) => {
	return (
		<div className='header-line'>
			<h3 className='header-title'>{title}</h3>
			{actions && actions.length > 0 &&
				<div className='header-actions'>
					{actions.map((action) =>
						<Clickable onClick={action.onClick}>
							{action.icon}
							<div className='header-action-label'>{action.label}</div>
						</Clickable>)
					}
				</div>
			}
		</div>
	);
};

export default Header;
