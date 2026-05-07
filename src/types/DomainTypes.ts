export interface DomainEntry {
	key: string;
	value: string;
	label: string;
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
