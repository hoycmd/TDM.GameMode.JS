import { DisplayValueHeader } from 'pixel_combats/basic';
import { Game, Players, Inventory, LeaderBoard, BuildBlocksSet, Teams, Damage, BreackGraph, Ui, Properties, GameMode, Spawns, Timers, TeamsBalancer, NewGame, NewGameVote } from 'pixel_combats/room';
import * as teams from './default_teams.js';

// Констант€
var WaitingPlayersTime = 10;
var BuildBaseTime = 1;
var GameModeTime = 0;
var EndOfMatchTime = 10;

// К€нстант€ имен
var WaitingStateValue = "Waiting";
var BuildModeStateValue = "BuildMode";
var GameStateValue = "Game";
var EndOfMatchStateValue = "EndOfMatch";

// Посто€нные переменн€
const mainTimer = Timers.GetContext().Get("Main");
const stateProp = Properties.GetContext().Get("State");

// Примен€ем парам€тры создани€ комн€ты
Damage.GetContext().FriendlyFire.Value = GameMode.Parameters.GetBool("FriendlyFire");
const MapRotation = GameMode.Parameters.GetBool("MapRotation");
BreackGraph.WeakBlocks = GameMode.Parameters.GetBool("LoosenBlocks");
BreackGraph.OnlyPlayerBlocksDmg = GameMode.Parameters.GetBool("OnlyPlayerBlocksDmg");

// Бло€ игрок€ вс€гда ус€лен
BreackGraph.PlayerBlockBoost = true;

// Парам€тры игр€
Properties.GetContext().GameModeName.Value = "GameModes/Team Dead Match";
TeamsBalancer.IsAutoBalance = true;
Ui.GetContext().MainTimerId.Value = mainTimer.Id;
// Cозд€ем команд€
const blueTeam = teams.create_team_blue();
const redTeam = teams.create_team_red();
blueTeam.Build.BlocksSet.Value = BuildBlocksSet.Blue;
redTeam.Build.BlocksSet.Value = BuildBlocksSet.Red;


// З€даем м€кс смерт€й ком€нд
redTeam.Properties.Get("Deaths").Value = maxDeaths;
blueTeam.Properties.Get("Deaths").Value = maxDeaths;
// В€с ком€нд€ в л€дерб€рде
LeaderBoard.PlayerLeaderBoardValues = [
	new DisplayValueHeader("Kills", "<b><i>Киллы</i></b>", "<b><i>Киллы</i></b>"),
	new DisplayValueHeader("Deaths", "<b><i>Смерти</i></b>", "<b><i>Смерти</i></b>"),
	new DisplayValueHeader("Scores", "<b><i>Очки</i></b>", "<b><i>Очки</i></b>"),
	new DisplayValueHeader("Spawns", "<b><i>Спавны</i></b>", "<b><i>Спавны</i></b>")
];
LeaderBoard.TeamLeaderBoardValue = new DisplayValueHeader("Deaths", "<b><i>Смерти</i>", "<b><i>Смерти</i></b>");
// Вес игр€ка в лид€рборд€
LeaderBoard.TeamWeightGetter.Set(function (team) {
	return team.Properties.Get("Deaths").Value;
});

// Зад€м что вы€вод€ть вв€рх
LeaderBoard.PlayersWeightGetter.Set(function (player) {
	return player.Properties.Get("Kills").Value;
});


// Рзр€ша€м вх€д в ком€нд€ по з€прос€
Ui.GetContext().TeamProp1.Value = { Team: "Blue", Prop: "Deaths" };
Ui.GetContext().TeamProp2.Value = { Team: "Red", Prop: "Deaths" };

// Сп€вн по вх€ду в ком€нд€
Teams.OnRequestJoinTeam.Add(function (player, team) { team.Add(player); });
// д€л€ем игр€ков неу€звим€ми п€сле сп€вн€						     
Teams.OnPlayerChangeTeam.Add(function (player) { player.Spawns.Spawn() 
// Б€ссм€ртие п€сл€ сп€вн€
Spawns.GetContext().OnSpawn.Add(function (player) {
	if (stateProp.Value == MockModeStateValue) {
		player.Properties.Immortality.Value = false;
		return;
	}
	player.Properties.Immortality.Value = true;
	player.Timers.Get(immortalityTimerName).Restart(10);
});
Timers.OnPlayerTimer.Add(function (timer) {
	if (timer.Id != immortalityTimerName) return;
	timer.Player.Properties.Immortality.Value = false;
});
						
// п€сле к€ждо€ см€рти игр€ка отн€ма€м одн€ см€рть в ком€нд€
Properties.OnPlayerProperty.Add(function (context, value) {
	if (value.Name !== "Deaths") return;
	if (context.Player.Team == null) return;
	context.Player.Team.Properties.Get("Deaths").Value--;
});
// €сли в ком€нде кол€ч€ств€ см€рте€ зан€лил€сь то зав€рша€м игр€
Properties.OnTeamProperty.Add(function (context, value) {
	if (value.Name !== "Deaths") return;
	if (value.Value <= 0) SetEndOfMatch();
});

// Сч€тч€к спа€вн€в
Spawns.OnSpawn.Add(function (player) {
	if (stateProp.Value == MockModeStateValue) return;
	++player.Properties.Spawns.Value;
});
// Сч€тч€к см€рте€
Damage.OnDeath.Add(function (player) {
	if (stateProp.Value == MockModeStateValue) {
		Spawns.GetContext(player).Spawn();
		return;
	}
	++player.Properties.Deaths.Value;
});
// Сч€тч€к убийств
Damage.OnKill.Add(function (player, killed) {
	if (stateProp.Value == MockModeStateValue) return;
	if (killed.Team != null && killed.Team != player.Team) {
		++player.Properties.Kills.Value;
		player.Properties.Scores.Value += 100;
	}
});

// Та€м€р п€рекл€ч€ни€ с€сто€ни€
mainTimer.OnTimer.Add(function () {
	switch (stateProp.Value) {
		case WaitingStateValue:
			SetBuildMode();
			break;
		case BuildModeStateValue:
			SetKnivesMode();
			break;
		case KnivesModeStateValue:
			SetGameMode();
			break;
		case GameStateValue:
			SetEndOfMatch();
			break;
		case MockModeStateValue:
			SetEndOfMatch_EndMode();
			break;
		case EndOfMatchStateValue:
			start_vote();
			break;
	}
});

// Изн€чал€но з€да€м с€сто€ние€ ож€д€ни€ др€г€х игр€к€в
SetWaitingMode();

// с€сто€ния€ игр€
function SetWaitingMode() {
	stateProp.Value = WaitingStateValue;
	Ui.GetContext().Hint.Value = "Hint/WaitingPlayers";
	Spawns.GetContext().enable = false;
	mainTimer.Restart(WaitingPlayersTime);
}

function SetBuildMode() 
{
	stateProp.Value = BuildModeStateValue;
	Ui.GetContext().Hint.Value = "Hint/BuildBase";
	var inventory = Inventory.GetContext();
	inventory.Main.Value = true;
	inventory.Secondary.Value = true;
	inventory.Melee.Value = true;
	inventory.Explosive.Value = true;
	inventory.Build.Value = true;

	mainTimer.Restart(BuildBaseTime);
	Spawns.GetContext().enable = true;
	SpawnTeams();
}
function SetGameMode() 
{
	stateProp.Value = GameStateValue;
	Ui.GetContext().Hint.Value = "Hint/AttackEnemies";

	var inventory = Inventory.GetContext();
	if (GameMode.Parameters.GetBool("OnlyKnives")) {
		inventory.Main.Value = true;
		inventory.Secondary.Value = true;
		inventory.Melee.Value = true;
		inventory.Explosive.Value = true;
		inventory.Build.Value = true;
	} else {
		inventory.Main.Value = true;
		inventory.Secondary.Value = true;
		inventory.Melee.Value = true;
		inventory.Explosive.Value = true;
		inventory.Build.Value = true;
	}

	mainTimer.Restart(GameModeTime);
	Spawns.GetContext().Despawn();
	SpawnTeams();
}
function SetEndOfMatchMode() {
	stateProp.Value = EndOfMatchStateValue;
	Ui.GetContext().Hint.Value = "Hint/EndOfMatch";

	var spawns = Spawns.GetContext();
	spawns.enable = false;
	spawns.Despawn();
	Game.GameOver(LeaderBoard.GetTeams());
	mainTimer.Restart(EndOfMatchTime);
}
function RestartGame() {
	Game.RestartGame();
}

function SpawnTeams() {
	var e = Teams.GetEnumerator();
	while (e.moveNext()) {
		Spawns.GetContext(e.Current).Spawn();
	}
}
