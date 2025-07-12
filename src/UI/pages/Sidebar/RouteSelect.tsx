import { NavLink } from "react-router-dom";
import { IconType } from "react-icons";
import {
  MdOutlineSmartToy,
  MdAssessment,
  MdPlayArrow,
  MdSettings,
  MdHistory,
  MdLeaderboard,
  MdPeople
} from "react-icons/md";
import { useDrawer } from "../../hooks";

interface RouteProps {
  Icon: IconType;
  title: string;
  to: string;
  target?: string;
  description?: string;
}

const routes: RouteProps[] = [
  { 
    Icon: MdOutlineSmartToy, 
    title: "AI Coach", 
    to: "coach",
    description: "Your personal CS2 AI coach"
  },
  { 
    Icon: MdAssessment, 
    title: "Performance", 
    to: "performance",
    description: "Track your progress and stats"
  },
  { 
    Icon: MdHistory, 
    title: "Match History", 
    to: "history",
    description: "Review past matches and analytics"
  },
  { 
    Icon: MdLeaderboard, 
    title: "Team Stats", 
    to: "team-stats",
    description: "Team performance and rankings"
  },
  { 
    Icon: MdPeople, 
    title: "Players", 
    to: "players",
    description: "Player profiles and statistics"
  },
  { 
    Icon: MdSettings, 
    title: "Settings", 
    to: "settings",
    description: "Configure your preferences"
  }
];

export const RouteSelect = () => {
  const { isOpen } = useDrawer();
  return (
    <div className="relative size-full overflow-y-auto">
      <div className="relative flex flex-col items-center justify-between gap-4 py-5">
        {routes.map((route, index) => (
          <NavRoutes key={index} {...route} />
        ))}
        <div className="flex size-full w-full border-t border-border pt-4 text-text">
          <button
            className="relative flex h-7 w-full items-center gap-1 rounded-lg bg-primary py-5 hover:bg-primary-dark transition-colors duration-200"
            onClick={() => window.electron.startOverlay()}
          >
            <MdPlayArrow className="absolute left-3.5 size-7" />
            {isOpen && (
              <>
                <p className="pl-14 font-semibold">Start Overlay</p>
                <span className="absolute right-3 text-xs opacity-60">⌘O</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const NavRoutes = ({ Icon, title, target, to, description }: RouteProps) => {
  const { isOpen } = useDrawer();
  return (
    <NavLink
      to={to}
      target={target}
      className={({ isActive }) =>
        `flex w-full items-center gap-4 rounded-lg py-3 pl-3.5 transition-all duration-200 ${
          isActive 
            ? "bg-background-light text-text shadow-lg" 
            : "text-text-secondary shadow-none hover:bg-background-light/50"
        }`
      }
    >
      {({ isActive }) => (
        <div className="flex h-7 items-center">
          <Icon
            className={`size-7 transition-colors duration-200 ${
              isActive ? "text-primary-light" : "text-text-disabled"
            } absolute`}
          />
          {isOpen && (
            <div className="flex flex-col pl-10">
              <p className={`font-semibold ${isActive ? "" : "text-text-disabled"}`}>
                {title}
              </p>
              {description && (
                <span className="text-xs text-text-disabled">
                  {description}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </NavLink>
  );
};
