import {Text} from "ink";
import {theme} from "../../utils/theme.js";

export function WelcomeLogo() {
  return (
    <Text color={theme.primary}>
      {String.raw` ____  ___ __  __ _____ _     _     _____
|  _ \|_ _|\ \/ /| ____| |   | |   | ____|
| |_) || |  \  / |  _| | |   | |   |  _|
|  __/ | |  /  \ | |___| |___| |___| |___
|_|   |___|/_/\_\|_____|_____|_____|_____|
        terminal design runtime`}
    </Text>
  );
}

