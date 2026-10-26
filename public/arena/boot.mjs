import {startArena} from './app.mjs';
import {startSpectator} from './spectator.mjs';
if(new URLSearchParams(location.search).get('spectator')==='1')startSpectator();
else startArena();
