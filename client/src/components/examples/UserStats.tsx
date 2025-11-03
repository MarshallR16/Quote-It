import UserStats from '../UserStats';

export default function UserStatsExample() {
  return (
    <UserStats
      username="JohnDoe"
      joinDate="January 2024"
      postsCount={42}
      totalVotes={1234}
      wins={3}
    />
  );
}
