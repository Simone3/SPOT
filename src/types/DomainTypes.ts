/**
 * How a domain entry is worded. Everything but a value entry stands for something the tasks never spell out, so the wording
 * has to be looked up rather than read off the task: the domain logic says which entry this is and the components translate it.
 */
export type DomainLabelKind = 'VALUE' | 'PRIORITY' | 'NO_OWNER' | 'NO_DUE_DATE' | 'NO_TAGS';

export interface DomainEntry {
	key: string;
	value: string;
	labelKind: DomainLabelKind;
	color?: string;
	persistent: boolean;
	count: number;
}

export interface FilterDomains {
	priorities: DomainEntry[];
	owners: DomainEntry[];
	dueDates: DomainEntry[];
	tags: DomainEntry[];
}

export interface FormDomains {
	priorities: DomainEntry[];
	owners: DomainEntry[];
	tags: DomainEntry[];
}

export interface DomainsContainer {
	filters: FilterDomains;
	form: FormDomains;
}
