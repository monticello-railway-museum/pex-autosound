type ScheduleEntry = {
    date: string;
    times: string[];
    studio: string;
};

export let schedule: { [year: string]: ScheduleEntry[] } = {
    '2023': [
        { date: '2023-11-17', times: ['17:00', '18:30', '20:00'], studio: 'DDS' },
        { date: '2023-11-18', times: ['17:00', '18:30', '20:00'], studio: 'DDS' },
        { date: '2023-11-19', times: ['17:00', '18:30'], studio: 'DDS' },
        { date: '2023-11-24', times: ['17:00', '18:30', '20:00'], studio: 'DDS' },
        { date: '2023-11-25', times: ['17:00', '18:30', '20:00'], studio: 'DDS' },
        { date: '2023-11-26', times: ['17:00', '18:30'], studio: 'DDS' },
        { date: '2023-12-01', times: ['17:00', '18:30', '20:00'], studio: 'AIM' },
        { date: '2023-12-02', times: ['17:00', '18:30', '20:00'], studio: 'AIM' },
        { date: '2023-12-03', times: ['17:00', '18:30'], studio: 'AIM' },
        { date: '2023-12-08', times: ['17:00', '18:30', '20:00'], studio: 'AIM' },
        { date: '2023-12-09', times: ['17:00', '18:30', '20:00'], studio: 'AIM' },
        { date: '2023-12-10', times: ['17:00', '18:30'], studio: 'AIM' },
    ],
    '2024': [
        { date: '2024-11-15', times: ['17:00', '18:30', '20:00'], studio: 'DDS' },
        { date: '2024-11-16', times: ['17:00', '18:30', '20:00'], studio: 'DDS' },
        { date: '2024-11-17', times: ['17:00', '18:30'], studio: 'DDS' },
        { date: '2024-11-22', times: ['17:00', '18:30', '20:00'], studio: 'DDS' },
        { date: '2024-11-23', times: ['17:00', '18:30', '20:00'], studio: 'DDS' },
        { date: '2024-11-24', times: ['17:00', '18:30'], studio: 'DDS' },
        { date: '2024-11-29', times: ['17:00', '18:30', '20:00'], studio: 'AIM' },
        { date: '2024-11-30', times: ['17:00', '18:30', '20:00'], studio: 'AIM' },
        { date: '2024-12-01', times: ['17:00', '18:30'], studio: 'AIM' },
        { date: '2024-12-06', times: ['17:00', '18:30', '20:00'], studio: 'AIM' },
        { date: '2024-12-07', times: ['17:00', '18:30', '20:00'], studio: 'AIM' },
        { date: '2024-12-08', times: ['17:00', '18:30'], studio: 'AIM' },
    ],
};
