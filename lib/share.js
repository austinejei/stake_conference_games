"use strict";
function shareBadge(player, players) {
  const completed = Object.values(player.progress).reduce(
    (sum, value) => sum + value,
    0,
  );
  const title =
    completed >= 90
      ? "Quest Complete"
      : completed >= 45
        ? "Adventure Champion"
        : completed >= 15
          ? "Trailblazer"
          : completed >= 5
            ? "Curious Explorer"
            : completed >= 1
              ? "First Discovery"
              : "Ready to Explore";
  const rank =
    player.points > 0
      ? 1 +
        players.filter((p) => p.age === player.age && p.points > player.points)
          .length
      : null;
  return {
    alias: player.publicName || "Explorer " + player.id.slice(0, 6),
    points: player.points,
    completed,
    total: 90,
    title,
    groupRank: rank,
  };
}
module.exports = { shareBadge };
