import 'src/components/common/AppErrorBoundary.css';
import type { ReactElement, ReactNode } from 'react';
import { Button } from 'src/components/inputs/Button';
import { WarningIcon } from 'src/components/icons/WarningIcon';
import { ErrorBoundary } from 'src/framework/renderer/ErrorBoundary';
import { useTranslator } from 'src/i18n/TranslationContext';

// Wraps the whole application rather than one page, so that a failure in a context provider above the router is caught too.
// Reloading is the recovery it offers: rendering the same tree again would usually only throw the same error a second time,
// while a reload starts over from the tasks the database holds.
const AppErrorBoundary = ({ children }: { children: ReactNode }): ReactElement => {
	const { t } = useTranslator();

	return (
		<ErrorBoundary
			onError={(error, componentStack) => {
				// Developer-facing: the renderer has no route into the operational log, and a stack is nothing the user can act on
				console.error('Unhandled render error', error, componentStack);
			}}
			renderFallback={() => {
				return (
					<div className='app-error-boundary' role='alert'>
						<div className='app-error-boundary-panel'>
							<div className='app-error-boundary-icon' aria-hidden='true'>
								<WarningIcon className='app-error-boundary-warning-icon'/>
							</div>
							<h1 className='app-error-boundary-title'>{t('crash.title')}</h1>
							<p className='app-error-boundary-message'>{t('crash.message')}</p>
							<Button
								className='app-error-boundary-reload'
								label={t('crash.reload')}
								onClick={() => {
									window.location.reload();
								}}
							/>
						</div>
					</div>
				);
			}}>
			{children}
		</ErrorBoundary>
	);
};

export { AppErrorBoundary };
