import 'src/components/tasks/TaskFilters.css';
import { type ReactElement } from 'react';
import { ButtonsSelect } from 'src/components/inputs/ButtonsSelect';
import { Checkbox } from 'src/components/inputs/Checkbox';
import { TextInput } from 'src/components/inputs/TextInput';
import { Header } from 'src/components/common/Header';
import { TASKS_CONFIG } from 'src/config/AppConfig';
import { ResetIcon } from 'src/components/icons/ResetIcon';
import { DateUtils, type SmartDateOptions } from 'src/framework/utils/DateUtils';
import { toDomainOptions } from 'src/components/tasks/DomainOptions';
import { useTranslator } from 'src/i18n/TranslationContext';
import type { SpotTranslator } from 'src/i18n/Translations';
import type { FilterDomains } from 'src/types/DomainTypes';
import type { TaskFilterChange, TaskFilters as TaskFiltersType } from 'src/types/FilterTypes';
import type { TaskPriorityValue } from 'src/types/TaskTypes';

// The framework decides which day a due date falls on, so this only names the days SPOT wants to call out. The weekday and
// full-date wording it falls back to comes from the same locale as the translator, so a due date can never be half translated.
const createDueDateLabelOptions = (translator: SpotTranslator): SmartDateOptions => {
	return {
		labels: {
			today: translator.t('dates.today'),
			yesterday: translator.t('dates.yesterday'),
			tomorrow: translator.t('dates.tomorrow')
		},
		weekdayHorizonDays: TASKS_CONFIG.dueDateWeekdayHorizonDays,
		locale: translator.locale
	};
};

type TaskFiltersProps = {
	domains: FilterDomains;
	filters: TaskFiltersType;
	onFilterChange: (changedFilters: TaskFilterChange) => void;
	onResetDefaultFilters: () => void;
};

const TaskFilters = ({ domains, filters, onFilterChange, onResetDefaultFilters }: TaskFiltersProps): ReactElement => {
	const translator = useTranslator();
	const { t } = translator;
	const dueDateLabelOptions = createDueDateLabelOptions(translator);

	return (
		<div className='task-filters-container'>
			<Header
				title={t('filters.title')}
				actions={[{
					id: 'reset',
					icon: <ResetIcon />,
					label: t('filters.reset'),
					onClick: onResetDefaultFilters
				}]}
			/>
			<div className='task-filters'>
				<TextInput
					label={t('filters.content')}
					placeholder={t('filters.contentPlaceholder')}
					value={filters.text}
					onChange={(value) => {
						return onFilterChange({ text: value });
					}}/>
				{domains.priorities.length > 0 &&
					<ButtonsSelect
						label={t('filters.priorities')}
						allowMultiSelect={true}
						value={filters.priorities}
						onChange={(value) => {
							return onFilterChange({ priorities: value as TaskPriorityValue[] });
						}}
						options={toDomainOptions(domains.priorities, translator)}/>
				}
				{domains.owners.length > 0 &&
					<ButtonsSelect
						label={t('filters.owners')}
						allowMultiSelect={true}
						value={filters.owners}
						onChange={(value) => {
							return onFilterChange({ owners: value as string[] });
						}}
						options={toDomainOptions(domains.owners, translator)}/>
				}
				{domains.dueDates.length > 0 &&
					<ButtonsSelect
						label={t('filters.dueDates')}
						allowMultiSelect={true}
						value={filters.dueDates}
						onChange={(value) => {
							return onFilterChange({ dueDates: value as string[] });
						}}
						options={toDomainOptions(domains.dueDates, translator, (dueDate) => {
							return DateUtils.toSmartString(DateUtils.fromStandardYearMonthDay(dueDate), dueDateLabelOptions);
						})}/>
				}
				{domains.tags.length > 0 &&
					<ButtonsSelect
						label={t('filters.tags')}
						allowMultiSelect={true}
						value={filters.tags}
						onChange={(value) => {
							return onFilterChange({ tags: value as string[] });
						}}
						options={toDomainOptions(domains.tags, translator)}/>
				}
				<Checkbox
					label={t('filters.showCompleted')}
					value={filters.showCompleted}
					onChange={(value) => {
						return onFilterChange({ showCompleted: value });
					}}
					accentSelectedColor={true}/>
			</div>
		</div>
	);
};

export { TaskFilters };
