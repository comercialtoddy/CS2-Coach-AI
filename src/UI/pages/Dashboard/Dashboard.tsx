import { useEffect, useState } from "react";
import { Container, ButtonContained } from "../../components";
import { CSGO } from "csgogsi";
import { GSI } from "../../api/socket";
import { Tile } from "./Tile";
import { Topbar } from "../MainPanel/Topbar";

export const Dashboard = () => {
  const [gameData, setGameData] = useState<CSGO | null>(null);
  const [layout, setLayout] = useState<any | null>(null);
  const [isOverlayActive, setIsOverlayActive] = useState(false);

  useEffect(() => {
    // Verificar se o electron está disponível
    console.log('Electron available:', !!window.electron);
    if (window.electron) {
      console.log('Electron methods:', Object.keys(window.electron));
    }

    GSI.on("data", (data: CSGO) => {
      setGameData(data);
    });
  }, []);

  const handleToggleOverlay = () => {
    try {
      console.log('Toggle overlay button clicked, current state:', isOverlayActive);
      console.log('Electron available:', !!window.electron);

      if (!window.electron) {
        console.error('Electron not available!');
        return;
      }

      if (isOverlayActive) {
        console.log('Stopping agent overlay');
        window.electron.stopAgentOverlay();
        setIsOverlayActive(false);
      } else {
        console.log('Starting agent overlay');
        window.electron.startAgentOverlay();
        setIsOverlayActive(true);
      }
    } catch (error) {
      console.error('Error toggling overlay:', error);
    }
  };

  return (
    <div className="relative flex size-full flex-col gap-4">
      <Topbar header="Dashboard" layout={layout} setLayout={setLayout} />
      <Container>
        <div className="flex flex-col gap-4">
          <div className="flex justify-end">
            <ButtonContained
              onClick={handleToggleOverlay}
              className={isOverlayActive ? "bg-red-500 hover:bg-red-600" : ""}
            >
              {isOverlayActive ? "Stop Agent Overlay" : "Start Agent Overlay"}
            </ButtonContained>
          </div>
          
          {gameData ? (
            <div className="grid grid-cols-3">
              <Tile
                title="Players Connected"
                body={
                  <>
                    {gameData.players.map((player) => (
                      <p className="place-self-center" key={player.steamid}>
                        {player.name}
                      </p>
                    ))}
                  </>
                }
              />
            </div>
          ) : (
            <h3>Not connected to a server</h3>
          )}
        </div>
      </Container>
    </div>
  );
};
