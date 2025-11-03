import WinnerCard from '../WinnerCard';

export default function WinnerCardExample() {
  return (
    <WinnerCard
      weekNumber={42}
      content="Be yourself; everyone else is already taken"
      author="Oscar Wilde"
      votes={892}
    />
  );
}
