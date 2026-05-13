import type { Command } from '@flight-types/Command';

import guideCommand from './guide';
import monitorDatesCommand from './monitorar-data';
import myDatesCommand from './minhas-datas';
import stopMonitoringCommand from './parar-monitoramento';
import pingCommand from './ping';
import promotionsCommand from './promocoes';

export const commands: readonly Command[] = [
  pingCommand,
  promotionsCommand,
  guideCommand,
  monitorDatesCommand,
  myDatesCommand,
  stopMonitoringCommand,
];
