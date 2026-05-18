import {Text} from "ink";
import {theme} from "../utils/theme.js";

export function WelcomeLogo() {
  return (
    <Text color={theme.primary}>
      {String.raw` ____  _          _ _      
|  _ \(_)_  _____| | | ___ 
| |_) | \ \/ / _ \ | |/ _ \
|  __/| |>  <  __/ | |  __/
|_|   |_/_/\_\___|_|_|\___|`}
    </Text>
  );
}

