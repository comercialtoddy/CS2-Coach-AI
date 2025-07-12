import { Sidebar } from "./Sidebar";
import { AppFrame, MainPanel } from "./MainPanel";
import { useThemes } from "../hooks";

export const Layout = () => {
  const { theme } = useThemes();
  
  return (
    <div className={`${theme} flex h-screen w-screen flex-col bg-gradient-to-br from-background-secondary to-background-primary text-text`}>
      <AppFrame />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar com efeito de vidro */}
        <div className="relative">
          <div className="absolute inset-0 backdrop-blur-md bg-background-secondary/30" />
          <Sidebar />
        </div>

        {/* Main Section */}
        <div className="flex flex-1 flex-col">
          <div className="relative flex-1">
            {/* Gradiente de fundo sutil */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
            
            {/* Conteúdo principal */}
            <MainPanel />
          </div>
        </div>
      </div>
    </div>
  );
};
