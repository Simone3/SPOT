import 'src/components/common/AppErrorBoundary.css';
import { useState, type ReactElement, type ReactNode } from 'react';
import { Button } from 'src/components/inputs/Button';
import { WarningIcon } from 'src/components/icons/WarningIcon';
import { ErrorBoundary } from 'src/framework/renderer/ErrorBoundary';
import { reportRenderError } from 'src/logic/Diagnostics';
import { useTranslator } from 'src/i18n/TranslationContext';

// Answered once the main process has written the failure, so the crash screen says nothing about a log file until it knows whether
// there is one to name
type RenderErrorLogReport = {
	logFilePath?: string;
};

// Wraps the whole application rather than one page, so that a failure in a context provider above the router is caught too.
// Reloading is the recovery it offers: rendering the same tree again would usually only throw the same error a second time,
// while a reload starts over from the tasks the database holds.
const AppErrorBoundary = ({ children }: { children: ReactNode }): ReactElement => {
	const { t } = useTranslator();
	const [ logReport, setLogReport ] = useState<RenderErrorLogReport | undefined>();

	return (
		<ErrorBoundary
			onError={(error, componentStack) => {
				// The window is showing this screen instead of the application, so the failure behind it has to outlive the session:
				// the renderer console is developer-facing and an installed SPOT has no way of opening it
				void reportRenderError(error, componentStack).then((logFilePath) => {
					setLogReport({ logFilePath });
				});
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
							{logReport && (
								<p className='app-error-boundary-log-location'>
									{logReport.logFilePath ? t('crash.logLocation', { logFilePath: logReport.logFilePath }) : t('crash.unknownLogLocation')}
								</p>
							)}
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
