import { useEffect, useState } from "react";
import { ButtonContained } from "../../components";
import axios from "axios";
import { apiUrl } from "../../api/api";

interface SettingsProps {
  onClose?: () => void;
}

interface SettingsData {
  autoSwitch: boolean;
  layout: string;
}

export const Settings = ({ onClose }: SettingsProps) => {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getSettings();
  }, []);

  const getSettings = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${apiUrl}/settings`);
      if (response.data) {
        setSettings({
          autoSwitch: response.data.autoSwitch ?? false,
          layout: response.data.layout ?? "vertical"
        });
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      setErrorMessage("Error loading settings");
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    
    setIsSubmitting(true);
    try {
      await axios.put(`${apiUrl}/settings`, settings);
      setIsSubmitting(false);
      if (onClose) onClose();
    } catch (error) {
      setErrorMessage("Error saving settings: " + error);
      setIsSubmitting(false);
    }
  };

  const handleToggle = () => {
    if (!settings) return;
    setSettings({
      ...settings,
      autoSwitch: !settings.autoSwitch
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 overflow-y-auto">
        <h2 className="border-b border-border pb-2 font-bold">Settings</h2>
        <div className="flex items-center justify-center p-8">
          <div className="text-text-secondary">Loading settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 overflow-y-auto">
      <h2 className="border-b border-border pb-2 font-bold">Settings</h2>
      <div className="container flex flex-col gap-6 overflow-y-auto">
        <div className="rounded-lg bg-background-secondary p-6 shadow-md">
          <h2 className="mb-4 text-xl font-semibold">CS2 Coach AI Directory</h2>
          <ButtonContained onClick={() => window.electron.openHudsDirectory()}>
            Open Directory
          </ButtonContained>
        </div>

        <div className="rounded-lg bg-background-secondary p-6 shadow-md">
          <h2 className="mb-4 text-xl font-semibold">
            Select Language (Coming Soon)
          </h2>
          <select className="w-full rounded-lg border border-gray-300 p-2">
            <option value="en">English</option>
            <option disabled value="es">
              Spanish
            </option>
            <option disabled value="fr">
              French
            </option>
            <option disabled value="de">
              German
            </option>
          </select>
        </div>

        <div className="rounded-lg bg-background-secondary p-6 shadow-md">
          <h2 className="mb-4 text-xl font-semibold">
            Auto-switch Sides (Coming Soon)
          </h2>
          <div className="flex items-center text-text-disabled">
            <label className="switch">
              <input
                type="checkbox"
                className="bg-text-disabled"
                disabled
                checked={settings?.autoSwitch ?? false}
                onChange={handleToggle}
              />
              <span className="slider round"></span>
            </label>
            <span className="ml-2">{settings?.autoSwitch ? "On" : "Off"}</span>
          </div>
        </div>

        <div className="rounded-lg bg-background-secondary p-6 shadow-md">
          <h2 className="mb-4 text-xl font-semibold">
            File Status (Not yet working)
          </h2>
          <p className="text-text-secondary">
            Check if the required files are installed:
          </p>
          <ul className="mt-2 list-inside list-disc"></ul>
          <button
            disabled
            className="mt-4 rounded-lg bg-gray-700 px-4 py-2 text-text-disabled"
          >
            Install Files
          </button>
        </div>
      </div>

      <div className="inline-flex w-full justify-end gap-2 border-t border-border p-2">
        {errorMessage && (
          <p className="my-1 text-end text-red-500">{errorMessage}</p>
        )}
        <div className="mt-1 flex justify-end gap-1">
          {isSubmitting ? (
            <ButtonContained disabled>Saving...</ButtonContained>
          ) : (
            <ButtonContained onClick={() => saveSettings()}>
              Save
            </ButtonContained>
          )}
          {onClose && (
            <ButtonContained color="secondary" onClick={onClose}>
              Cancel
            </ButtonContained>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
