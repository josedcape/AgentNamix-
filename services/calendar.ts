
/**
 * Service to handle Google Calendar interactions via direct link generation (Intent Links).
 * This allows the agent to "schedule" events by providing a pre-filled link to the user,
 * avoiding complex OAuth flows while still providing direct interaction capability.
 */

export interface CalendarEvent {
  title: string;
  description: string;
  startTime: string; // ISO String or '2024-01-01T10:00:00'
  endTime: string;   // ISO String
  location?: string;
}

export const generateGoogleCalendarLink = (event: CalendarEvent): string => {
  const formatDate = (dateStr: string) => {
    // Basic cleanup to ensure format YYYYMMDDTHHMMSSZ
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().replace(/-|:|\.\d\d\d/g, "");
  };

  const start = formatDate(event.startTime);
  const end = formatDate(event.endTime);
  
  const params = new URLSearchParams();
  params.append('action', 'TEMPLATE');
  params.append('text', event.title);
  if (start && end) {
      params.append('dates', `${start}/${end}`);
  }
  params.append('details', event.description);
  if (event.location) params.append('location', event.location);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

export const createCalendarActionResponse = (event: CalendarEvent): string => {
    const link = generateGoogleCalendarLink(event);
    
    return `
<div class="bg-gray-800 border-l-4 border-green-500 p-4 rounded my-4">
  <div class="flex justify-between items-start">
    <div>
        <h4 class="font-bold text-green-400 text-lg">📅 Evento Programado</h4>
        <p class="text-white font-bold mt-1">${event.title}</p>
        <p class="text-gray-400 text-sm">${new Date(event.startTime).toLocaleString()} - ${new Date(event.endTime).toLocaleTimeString()}</p>
        <p class="text-gray-500 text-xs mt-2 italic">${event.description}</p>
    </div>
    <a href="${link}" target="_blank" class="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded shadow-lg flex items-center gap-2 text-sm transition-transform hover:scale-105">
      <span>Agregar a Google Calendar</span>
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  </div>
</div>
    `;
};
