export const formatLastSeen = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const diff = Math.max(0, now.getTime() - date.getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "last seen just now";
  if (minutes < 60) return `last seen ${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24 && date.toDateString() === now.toDateString()) {
    return `last seen today at ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `last seen yesterday at ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }

  return `last seen ${date.toLocaleDateString([], { day: "numeric", month: "short" })} at ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
};
