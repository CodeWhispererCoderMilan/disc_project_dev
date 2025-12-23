# Welcome to the Official "[ ] Griefhem" Dev Repo
 
This GitHub repository has been put together as a base for the humble begginings of a discord game. To all developers contributing their time and sharing their input, thank you!
I have put together this file to shed some light on the methods, functions, stack, requirements and repository guidelines. Besides the technical, I'll provide an overview of the game.

# Table of contents

1. [Game Overview](#Overview)

    1. [General](#General)

	2. [Drops system](#XPsystem)

	3. [Roles&Bots](#RolesAndBots)

2. [Tech Stack](#Stack)

3. [Prerequisites](#Prerequisites)

4. [Requirements and Repository Guidelines](#ReqsAndRepo)

5. [Project Structure](#projectStructure)

	1. [index.js](#index)

	2. [botSetup.js](#botSetup)

	3. [role_commands](#maggot)

    4. [fireBaseDb.js](#firebaseDb)

    5. [querys.js](#querys)

    6. [redisCache.js](#redisCache)

    7. [botActions.js](#botActions)

    8. [game_config.json](#gameConfig)

    9. [game_state.js](#gameState)


<a name="Overview"></a>


## Game Overview


<a name="General"></a>


## _**General**_

"[] Griefhem" is a text based massive-multiplayer game centered around social deduction (the style of Town of Salem & Among Us), all within a Discord Server. It makes use of Discord's API, the main mechanic revolves around roles and channel permissions and the UI makes use of Discord ActionRows and Modals. Each player has a single role, namely their place on the social ladder (peasant, merchant, knight etc.) - this role also grants access to specific text channels which serve as our locations (farms, decrepit tunnels etc.). Each role has access to its' respective ead-only role_commands channel, where each role can use their abilities through ActionRows (buttons + selectMenus). A player's goal is to climb up the ladder to emperor and avoid death using role-specific abilities, combined abilities(involving multiple players) along with schemeing and deceiving within the text channels.

<a name="Drops System"></a>


## **Drops system**

Drops are the economy of the game. All abilities cost drops, some  abilities grant drops. In lower roles, users are promoted to the next role when their acumulated drops pass a certain threshold. In the higher roles drops are used to maintain your grip over those beneath as well to sway those above in your favour.Drops are updated incrementally, on each update all users get drops (currently all get the same amount, drops granted should vary based on role). Drops are implemented using Firebase's real-time DB along with a local redis cache for improved response time and lower DB request rate.

<a name="RolesAndBots"></a>


## **Roles&Bots**

Discord roles are the "levels" players go through. Each has its' own read-only role_commands channel. Each channel has a role-specific bot assigned to it, the bot sends a single message which users can interact with to use their abilities and check their status(checking XP not yet implemented).

* Roles are:
	* Poop
	* Maggot
	* Cockroach
	* Rat
	* Sub-human
	* Peasant
	* Scholar
	* Merchant
	* Knight
	* Noble
	* Lord
	* King
    * Emperor

Besides role specific bots, there is also the console_bot which handles the periodic XP boost, users joining/leaving the server and future server-wide tasks.

<a name="Stack"></a>



## Tech Stack


The libraries used in the project:
	
* discord.js
* redis
* firebase + firebase-admin
* dotenv
* config

All development branches must only use these libraries.

<a name="Prerequisites"></a>


## Prerequisites

In order to get started working on the project a few steps are needed after cloning the repo to your local enviroment:


## __1. .env File__

Add a .env file to the project's directory, this will store all your sensitive data(keys, tokens etc.). its' contents should look like this:

    TOKEN_CONSOLE=
	TOKEN_POOP=
	TOKEN_MAGGOT=
	TOKEN_COCKROACH=
	TOKEN_RAT=
	TOKEN_SUBHUMAN=
	TOKEN_PEASANT=
	TOKEN_SCHOLAR=
	TOKEN_MERCHANT=
	TOKEN_KNIGHT=
	TOKEN_NOBLE=
	TOKEN_LORD=
	TOKEN_KING=
	TOKEN_EMPEROR=
	CLIENTID_CONSOLE=
	CLIENTID_POOP=
	CLIENTID_MAGGOT=
	CLIENTID_COCKROACH=
	CLIENTID_RAT=
	CLIENT_SUBHUMAN=
	CLIENTID_PEASANT=
	CLIENTID_SCHOLAR=
	CLIENTID_MERCHANT=
	CLIENTID_KNIGHT=
	CLIENTID_NOBLE=
	CLIENTID_LORD=
	CLIENTID_KING=
	CLIENTID_EMPEROR=
	GUILDID=
	CHANNELIDSEWERS=
	CHANNELIDPOOP=
	CHANNELIDMAGGOT=
	CHANNELIDCOCKROACH=
	CHANNELIDRAT=
	CHANNELIDSUBHUMAN=
	CHANNELIDPEASANT=
	CHANNELIDMERCHANT=
	CHANNELIDSCHOLAR=
	CHANNELIDKNIGHT=
	CHANNELIDKING=
	CHANNELIDLORD=
	CHANNELIDNOBLE=
	CHANNELIDEMPEROR=
	ROLEID_POOP=
	ROLEID_MAGGOT=
	ROLEID_COCKROACH=
	ROLEID_RAT=
	ROLEID_SUBHUMAN=
	ROLEID_PEASANT=
	ROLEID_SCHOLAR=
	ROLEID_MERCHANT=
	ROLEID_KNIGHT=
	ROLEID_NOBLE=
	ROLEID_LORD=
	ROLEID_KING=
	ROLEID_EMPEROR=
	FIREBASE_DATABASEURL=
	FIREBASE_SERVICE_ACCOUNT=

## __2. Setting up firebase__

Firebase is a free-of-charge BaaS platform, in the project it is used to store user data (XP and Role) as well as GameData (player de/buffs and their timeframe). First make a firebase account, start a new project and add a Real-Time Database to your project. Once complete, get your `FIREBASE_SERVICE_ACCOUNT` JSON from your settings along with your `FIREBASE_DATABASEURL` and add the to the .env file. `FIREBASE_SERVICE_ACCOUNT` needs to be converted so that it can be added to the env file and, it is parsed in the project with `JSON.parse()` to convert it back to JSON.
For a JSON like this:

	{
		"apiKey": "slslsls",
		"slsls": "lelsls"
	}

we store it in the .env as:

	OUR_JSON={"apiKey":"slslsls","slsls":"lelsls"}

## __3. Setting up redis__

Redis is an in memory storage which works primarily as a key-value database. In this project it's used for caching to store DB data for easy access and data that doesnt require continuity(Ability cooldowns). We use it to quickly read relevant data without overwhelming the DB.
To set-up a local redis server: 

Official redis installation guide: [Redis Installation Guide](https://redis.io/docs/latest/operate/oss_and_stack/install/install-redis/)

Once your redis server is running on the default port, you're all set. If you want to use a different port make sure to adjust the `redis.createClient()` function and pass your redis host and port as parameters.

## __4. Discord API__

In order to be able to connect your bots to the game server, you will need a few keys to add to your .env file. First you must have a discord account and join the server, where you will be able to retrieve all the keys for your .env file (`guildId`,`channelIds` and `roleIds`).The bot token for the bot you're working on will be provided. Not all the values mentioned above need to be added to the .env, only those relevant to the bots you are working on. In botSetup.js make sure to comment out the lines in `initializeBots()` that do not concern the bots you are working on:
		
        function initializeBots(){
            createConsoleBot(process.env.TOKEN_CONSOLE);
	    	//createBot(process.env.TOKEN_POOP,process.env.CHANNELIDPOOP, setupPoopBotEvents,messagePoopCommands);
		    createBot(process.env.TOKEN_MAGGOT,process.env.CHANNELIDMAGGOT,setupMaggotBotEvents,messageMaggotCommands);
		    //createBot(process.env.TOKEN_COCKROACH,process.env.CHANNELIDCOCKROACH, setupCockroachBotEvents,messageCockroachCommands);
		    //createBot(process.env.TOKEN_RAT, process.env.CHANNELIDRAT, setupRatBotEvents,messageRatCommands);		
		    //createBot(process.env.TOKEN_SUBHUMAN,process.env.CHANNELIDSUBHUMAN,setupSubhumanBotEvents,messageSubhumanCommands);
		    //createBot(process.env.TOKEN_PEASANT,process.env.CHANNELIDPEASANT,setupPeasantBotEvents,messagePeasantCommands);
		    //createBot(process.env.TOKEN_MERCHANT,process.env.CHANNELIDMERCHANT,setupMerchantBotEvents,messageMerchantCommands);
		    //createBot(process.env.TOKEN_SCHOLAR,process.env.CHANNELIDSCHOLAR, setupScholarBotEvents,messageScholarCommands);
		    //createBot(process.env.TOKEN_KNIGHT, process.env.CHANNELIDKNIGHT,setupKnightBotEvents,messageKnightCommands);
		    //createBot(process.env.TOKEN_NOBLE,process.env.CHANNELIDNOBLE,setupNobleBotEvents,messageNobleCommands);
		    //createBot(process.env.TOKEN_LORD,process.env.CHANNELIDLORD,setupLordBotEvents,messageLordCommands);
		    //createBot(process.env.TOKEN_KING,process.env.CHANNELIDKING,setupKingBotEvents,messageKingCommands);
		    //createBot(process.env.TOKEN_EMPEROR,process.env.CHANNELIDEMPEROR,setupEmperorBotEvents,messageEmperorCommands);
        }

This is how the function should look if you were working on the Maggot bot handling maggot commands. The console Bot is not commented out because it handles the periodic XP boosts which is crucial for most abilities and helps with testing out user interactions with the bot.

To make sure everything runs smoothly, run the apllication through a terminal in the rood directory:

	node index.js

If you do not get any errors and the app runs continuously, you're done!
Now that you have your .env file with your firebase, redis and Discord API variables set, you're all set to start coding!


<a name="ReqsAndRepo"></a>


## Requirements, testing and repository outlines

For consistency all developers should follow the current naming conventions along with standard indentation for readability. Any new game configuration globals should be added to `game_config.json` .

The tech stack should be strictly followed, no new libraries/APIs should be used.

All code to be implemented should resemble existing code. Currently unimplemented abilities were all conceptualized with existing abilities in mind. The individual task files of each developer should contain all neccesary references for the implementation of the abilities they were attributed.

the Discord server should be managed carefully, loosing server functionality, changing permissions, deleting channels and any other drastic server changes should be avoided. Server access should be used solely for testing the code of your bot and it's interaction with users.

All development must be tested thouroughly through test files, every function and `.js` method shoould have a corresponding tests and `.test.js` jest file with all appropriate mocks implemented in `__mocks__`;

Within the GitHub repository, each developer must create their own branch, once a task is complete, I will merge the branch, do not merge or edit the main branch or the branches of other developers.


<a name="ProjectStructure"></a>



##  5. Folders, Files & Functions

The directory structure is intuitive, in the root directory there are `game_config.json` (globals that we use for game mechanics lie cooldowns, XP thresholds and ability XP costs) and `.env` along with `botSetup.js`, the method which exports the function we use to intialize bots in `index.js`.

In `apis`, which is the root containing the redis and firebase folders, these contain all the functions to intialize and handle the connections with our DB and cache. Keep in mind the Cache alwys follows any changes in the DB so our firebase files often call functions from our redis, to maintain a cache that refleccts the data in the DB.

In `role_commands` we have a file for each individual bots, these files typically contain the bot interaction handlers along with the `messageROLENAMEcommands()` function that is passed on to botSetup and handles sneding the singular interactive messsage to the appropriate group, this message will surve as the UI or command center for each player with that role.

in `functions` we have said functions that bots in our game might often use, like changing the role of a user (while maintaining our 1 role policy) a, handling the constant XP boosts, boosting XP lost in server down-time and building UI elements (lke select menus with players of a certain role).

Finally, in `mocks` we have all the mock files needed to run our jest test files(a mock firebase API ). Although undeveloped, the goal would be to have sound testing for all our files with all the neccesary mocks, crucial to development is sound testing files in order to avoid as much as possible the hassle of an ultra buggy alpha launch.

<a name ="index"></a>


## __1. index.js__

index.js is the start-up file, it intializes the redis server connection then caches all the data from the DB, then finally initializes the bots to send their interactive message on the appropriate servers and handle their specific interaction events.

<a name = "botSetup"></a>



## __2. botSetup.js__

Handles bot authentication & intialization. Consolebot is handled with its' own function, other than that each bot is intialized with `createBot(token, channelId, setupEventsFunction,messageCommands)` which logs the bot and initializes it to message it's respective server with the user UI, this is done through the `setupRoleEvents(client)` and `messageRoleCommands(client)` functions which are in each bot's specific role_commands file. Also notable is the setupRoleUpdate function  which is called bhy each bot and handles possible role update events in case an ability handled by the bot must trigger a user's role change (if a target is killed by an ability for ex.),for consoleBot this is used for leveling up (whenever a user's XP reaches a role's threshold - as seen in game_config.json).

<a name = "role_commands"></a>


## __3. role_commands folder__
This folder contains a file for each bot role, each file contains all interaction handlers and functions needed for the bot to handle its' role abilities and their respective UI. Each bot combines Cache, DB and Discord API methods for handling abilities that are triggered through the Action Row messages sent to their channels. UI responsiveness - up-to-date select menus, buttons and text displayed within the interactive message - is guaranteed through custom and discord client event handlers. `guildMemberUpdate` & `guildMemberRemove` are event handlers used in each bot file to keep select menus up to date with current role holders, disable appropriate buttons & edit text base on game state. Below are overviews of the currently implemented bot files:

## poop_commands.js

Poop players have **no active abilities** — they are the bottom caste of Griefhem. 

This file listens for global demotion events and displays short-lived system messages when Poops are targeted. The poop bot **does not trigger abilities** — it reacts to external ones.

* Passively receives notifications when being:
  * Festered by a maggot (XP siphon)
  * Devoured by cockroaches, rats, subhumans, etc.
  * Reduced to Poop by higher-tier abilities
* Re-renders the UI when server status changes


## maggot_commands.js

Maggots have a single ability, "Fester", this enables them to siphon XP from a selected poop for a set amount of time (FesteringDuration) and at the cost of XP (FesterCost), it also has it's own user-specific cooldown. The festering effect is tracked in both DB and Cache, and changes the behaviour of the `DBUpdateXP()` function in "querys.js". It's Ui consists of an unfestered poops select menu and a "fester"  trigger button.

	* getUnfesteredPoops() is the function we call to retrieve all unfestered poops for our select menu.
	* fester() is the function we call to deduct the fester cost from the user's XP and add the festering effect to the DB.
	* updateFesterSelectmenu() updates the select menu with an updated list of unfestered poops.
	* buildUnfesteredPoopSelectMenu() is the function we call to build a new select menu with an updated list of unfestered poops.

The `'guildMemberUpdate'` handler, checks if there are new poops or if any festering maggots or festered poops changed roles and triggers an update of the festering select menu along with a removal of appropriate fester relations from the DB and Cache (`DBClearFestering(maggotId)` also clears the cache festering data).
The interaction events:

    * 'selectPoop' locks in a target for festering and enables the fester button
	* 'fester' handles the fester button clicks, checks if all fester requirements are met and calls fester(client, maggotId, poopId), otherwise the user is notified (not enough XP or fester is on cooldown)
	* 'festeringStatusChanged' handles every situation where the message must be updated with unfestered poops select menu component.


## cockroach_commands.js
__Infanticide__ just demotes a selected maggot target at the cost of XP (InfanticideCost), it also has a user-specific cooldown meaning you can only use it so often. To commit infanticide users must interact with the "UI" in the bot's message, which is a select menu and a button trigger. The select menu for maggots updates whenever a player becomes a maggot or was a maggot (see the guild member update event handler - which trigers a re-rendering of the select menu). The trigger button triggers an interaction that is handled to change the role of the selected maggot to "Poop", deduce the XP cost fron the player, start the cooldown timer for their infanticide ability, and reset the selectMenu to it's previous state(no selection/placeholder). So, for infanticide we have the `'guildmemberUpdate'` event handler codeblock that keeps our select menu live, the `'selectMaggot'` interaction handler which selects a target and the `'commitInfanticide'` interaction handler which handles the trigger button clicks.

__Swarm__ swarm is more complex , it involves multiple states that also change the UI. Similar to infanticide, we have a subhuman select ,enu that is updated live using guild member update, second we have our swarm button. Players pick a target and intiate the swarm, this starts a timer and changes the swarm button to join swarm for all players, along with a change in the content of the bot message, notifying cockroaches  @swarmstarter's swarm is brewing. Players can join the swarm if 3 more cockroaches join before the timer ends it continues to the next phase, otherwise it fails and goes back to the intial message with the swarm button , a reset select subhuman menu and no swarm notification in message content. in the second phase, if 4 cockroaches joined and are still "alive" a new timer starts, in this time no cockroaches can join (the button is disabled) and if any of the conckroaches die, the swarm fails, else the swarm succeeds, the target's role is successfully changed, the swarm cooldown(which is universal for all cockroaches not specific to a single user) is intiated in the cache and a success notification is sent.
In the `'guildMemberUpdate handler'`, if any cockroaches change roles within a swarms first phase the swarm count is lowered,in the second phase , the swarm ends and if the intiator changes roles in either phase the swarm ends as well - this sheds some light on all interaction events:

	* 'subhumanSelect' selects the swarm target in the select menu
	* 'swarmInitiated' triggers the first phase
	* 'joinSwarm' handles the join button and triggers the second phase when there are 4 cockroaches in the swarm
	* 'swarmInitiatorRoleChanged' handles the rolechange of the initiator(swarm fail).
	* 'swarmParticipantDied' handles the rolechange if a cockroach within the second phase of the swarm (swarm fail).
	* 'swarmComplete' handles a successful swarm.

`resetSwarm()` is called to reset the message components related to the swarm (subhuman select menu, swarm/joinSwarm button and swarm message content) to their pre-swarm state (enabled subhuman selectMenu, enabled swarm button and intial message content)

## rat_commands.js

Rats have two abilities:

__Nibble__ Demote a selected **maggot or cockroach** to Poop.
* Costs drops  
* Has a personal cooldown  
* Requires selecting a target from a live role menu  
* Sends humiliation message to victim channel  
* Resets selection after use  

Solo aggression — efficient predation of the lower vermin.

__Plague__ A cooperative, timed, two-phase extermination mechanic against mid-tier roles:

1. **Phase 1 (Rally Rats)**  
   * A Rat selects a higher-tier target (Subhuman → Knight)  
   * Other Rats must join before the phase timer ends  
   * If too few participate → plague fails  

2. **Phase 2 (Target Resolution)**  
   * All joining Rats lock their target votes  
   * If votes on a target meet the threshold for that target's role tier  
   * Target(s) are **forcibly demoted to Poop**  

System behavior:
 
* Plague cancels if rats die / leave mid-plague  
* UI resets after success/failure  
* Broadcasts plague announcements to Rat channel 

## subhuman_commands.js
__Depravity__ demote a subhuman to poop. 

__Manhunt__ demote a peasant to poop.

__Pickings__ Demote a maggot,cockroach or rat to poop.

## peasant_commands.js
Peasants have two coordinated abilities affecting nearby and upper tiers:

__MobFlaying__ Collective demotion of a selected **peasant or subhuman** to Poop.

* Select target (Peasant/Subhuman)
* Initiator starts timed vote
* Other Peasants join via button
* If participation ≥ threshold → target becomes Poop
* Personal cooldown for initiator
* Cancels if initiator/target loses Peasant role or leaves
* UI updates dynamically during voting

__Revolution__ Triggers or joins the server-wide revolution

## scholar_commands.js
Scholars support uprisings and can send strategic messages upward.

__Advise__ Send a message to upper authority (Royal Castle) through a modal.

* Modal text input → message delivered to castle handler
* Per-user cooldown
* Event-driven acknowledgement + ephemeral reply

__Revolution__ Triggers or joins the server-wide revolution

## merchant_commands.js

Merchants manipulate XP economy and influence political flow.

__Bribe__ Grant XP to a selected target.

* Modal input for XP + optional message  
* Validates XP balance  
* Deducts from merchant, adds to target  
* Per-user cooldown  

__Endow__ Apply XP gain multiplier link to a chosen **Peasant/Scholar/Merchant/Knight/Noble**.

* Target receives 1.5x XP  
* Merchant earns 0.5x of target XP gains  
* Costs XP to apply  
* Duration + cooldown enforced  
* Prevents duplicate endow on same target

__Revolution__ Triggers or joins the server-wide revolution

## knight_commands.js
Knights execute targeted demotions and manage writ permissions.

__CutDown__ Demote a selected **Peasant → King** to Poop.

* Select target (Peasant–King)
* If target is **Knight/Noble/Lord/King** → must have valid writ level (Imperial/Royal/Eminent/etc.)
* If no writ required → costs XP
* Executes writs and awards XP when successful
* Per-user cooldown
* Cancels if roles change or user leaves

__ShowWrits__ View active writs and rewards.

* Lists writ type, target, status, reward
* Used for tracking CutDown eligibility and gains

__Revolution__ Triggers or joins the server-wide revolution

__Coup__ Knight-only coordinated overthrow against upper tiers.

* Select **Noble → King** target
* Start/join coup
* Follows same vote/phase logic as revolution

__JoinSiege__ Join King-initiated siege.
* Only enabled during siege
* Counts toward knight participation threshold
## noble_commands.js
Nobles issue writs and initiate assassination events.

__HighWrit__ Issue a writ ordering a Knight to cut down a lower-tier user.

* Select **human target (Peasant/Scholar/Merchant)** and **Knight**
* Modal collects message + reward amount
* Deducts drops from Noble
* Creates writ in cache (Knight executes later via CutDown)
* Per-user cooldown

__Assassination__ Coordinated demotion of **Knight/Noble/Lord** to Poop.
* Select target (Knight/Noble/Lord)
* Start vote timer
* Nobles join via button
* If participants ≥ threshold before timeout → target demoted
* Per-user global cooldown
* Cancels if initiator or target changes role/leaves
* Disabled if too few nobles online

__ShowWrits__ Display writs issued by this Noble.

* Shows Knight, target, status, reward
* Returns drops on annulled/failed writs

System notes:
* Disables menus during active assassination
* Resets session state after success/failure
## lord_commands.js

Lords execute writs and run promotion elections.

__Exile__ Demote **Peasant/Scholar/Merchant** to Sub-human.

* Select low-tier user
* Costs XP + cooldown
* Cancels if target changes role
* Triggers event + confirmation message

__EminentWrit__ Issue a writ ordering a Knight to cut down a **human target**.

* Select **human** + **Knight**
* Modal → message + drop amount
* Deducts drops & writes to cache
* Knight later executes writ via __CutDown__
* Cooldown applied

__Election__ Promote via vote:

* Select **Noble → promote to Lord**  
  OR **Lord → promote to King**
* Start timed vote
* Lords join until threshold met or timeout
* Cancels on role change / leave
* Cooldown after initiating

__Vote__ Join an active Lord election.

* Adds voter to set
* Vote threshold → immediate promotion

## king_commands.js

Kings manage nobility and run sieges against rival Kings.

__Degradation__ Demote a **Knight → Merchant**.

* Select Knight
* Costs XP + cooldown
* Emits event + XP update

__Knight__ Promote **Peasant/Scholar/Merchant** to Knight.

* Select low/mid-tier user
* Costs XP + cooldown
* Emits role change + event

__RoyalWrit__ Issue writ ordering a Knight to cut down a selected target.

* Select **Knight + target (Peasant → Lord)**
* Modal → message + drops
* Deducts XP and stores writ
* Cooldown applied

__Siege__ Start a siege on rival King.

* Select target King
* Costs XP
* Knight participation ratio determines success
* Knights can join via __JoinSiege__ UI
* Ends early on threshold or failure

__ShowWrits__ Display writs issued by this King.

## emperor_commands.js

Emperor controls succession and highest-tier writs.

__Coronation__ Promote **Lord → King**.

* Select Lord
* Costs XP + cooldown
* Role change + broadcast event

__Dethrone__ Demote **King → Lord**.

* Select King
* Costs XP + cooldown
* Broadcast success event

__HeirSuccession__ Transfer throne to selected King.

* Select King as heir
* Costs XP + cooldown
* Current Emperor becomes King
* Heir becomes Emperor
* Triggers succession events

__ImperialWrit__ Issue writ ordering Knight to cut down a selected target.

* Select **target (Peasant → King)** + Knight
* Modal → message + drop reward
* Deducts XP and persists writ
* Cooldown applied

__ShowWrits__ Display writs issued by the Emperor.

## console_commands.js

The Console is a system/admin panel for global state, role forcing, XP checks, and astral entry.

__/changerole__ Force-change a user’s role.

* `/changerole user:@target role:"RoleName" keep_xp:true|false`
* Admin-only
* Direct role assignment, bypasses game logic

__CheckDrops__ Button: shows current drops.

* Fetches cached Drops
* Cooldown enforced
* Ephemeral feedback

__Divination__ Enter Astral Realm (Scholar/Emperor only).

* Scholar = listen only
* Emperor = can speak
* Role-gated + cooldown

__Revolution & Coup System Hooks__ Console reacts to and maintains global upheaval mechanics.

* Tracks counts for **Peasant → Emperor** tiers
* Enables/disables revolution/coup based on population thresholds
* Handles:
  * First phase start
  * Second phase checks
  * Elections
  * Fail conditions
  * Event routing to channels

__Auto Role Init__ On member join → assign Poop + register in DB.

__Global XP Boost Scheduling__ Handles missed XP ticks on restart and reschedules boosts.

__Writ & Event Routing__ Dispatches writ updates + revolution/coup UI refresh via eventEmitter.

System notes:
* Uses Firebase + Redis for XP, roles, writs
* Updates role population counts to enforce thresholds
* Maintains console UI button state (server up/down)

<a name="firebaseDb"></a>


## __4.firebaseDb.js__

this file intializes the DB connection, it authenticates to firebase through the credentials and connects to the database.

<a name = "querys"></a>


## __5.querys.js__

This file contains all functions that communicate with our DB as well as the Caching from DB functions. DB functions also call redis cache functions to store the same data.

* `CacheDataFromDB()` caches userXP and festering data from our DB, it is called on start up.
* `CacheAllUserXP()` caches XP of all users
* `CacheFesteringUsers()` caches all festering data
* `DBgetUser()` gets user specific data
* `DBAddUser(member)` adds a new user to the DB users data
* `DBRemoveUser(member)` removes a user from the data, called when users leave the server.
* `DBUpdateXP(userId, xpChange, client)` updates XP for a specific user, behaves differently for users that are festered/festering. it's used to deduct ability costs and for the periodic user XP, future abilities will also use it to grant XP to users.
* `DBResetXP(userId)` resets a users XP to 0, used when a role is changed.
* `DBSetRole(member, newRole)` changes the role value of a user in the DB.
* `DBGetLastXPBoostTime()` get the timestamp of the last timed xp boost 'LastXpBoost', used to calculate time elapsed since last scheduled xp boost.Also used at start-up for recovering missed xp boosts in down time.
* `DBsetLastXPBoostTome(time)` used to set 'LastXpBost' after a successful XP boost.
* `DBboostForAllUsers(xpBoost, client)` useful to update XP of all users at once, used in the scheduled XP boost.
* `DBSetFestering(maggotId, poopId)` used to set festering data for a maggot,poop pair in the DB.
* `DBGetFestering(maggotId)` checks if a certain maggot is festering on a poop and returns the poop if true, null otherwise.
* `DBClearFestering(maggotId)` clears the festering relation between a maggot and a poop using the maggot ID parameter.
* `DBGetActiveFestering()` returns all festering maggot poop pairs in the DB.

<a name = "redisCache"></a>


## __6.redisCache.js__

This method contains functions that interact with the redis server, since the cache is meant to mirror our DB, most of the functions we use mirror their corresponding DB function. Every write to the DB is a write to the cache.


* `initializeRedis()` connects the app to the redis server and clears the cache on start up, our cache does NOT provide continuity
* `CacheAddUser(userId)` add a new user to cached players, called whenever someone joins the server and has to be added to the data
* `CacheRemoveUser(userId)` removes a user from the cached users, called when users leave the server
* `CacheSetUserXP(userId, xp)` sets `xp` for user with ID `userId` in cached users
* `CacheGetUserXP(userId)` gets XP value for user with userId `userId`
* `CacheSetFestering(maggotId, poopId, endTime)` sets a festering relation to cache for user with id `maggotId` and target with ID `poopId`
* `CacheClearFestering(maggotId)` clear festering relation for users with ID `maggotId`
* `CacheGetFesteringTarget(maggotId)` get existing festering data for user with ID `maggotId`
* `closeRedisConnection()` close redis connection , called whenever the application shuts down
* `CacheSetCooldown(cockroachId, startTime)` sets cooldown for infanticide ability for user with ID `cockroachId`
* `CacheClearInfanticideCooldown(cockroachId)` clears infanticide cooldown for user with ID `cockroachId`
* `CacheGetCooldown(cockroachId)` get infanticide cooldown for user with ID `cockroachId`
* `CacheSetSwarmCooldown(startTime)` sets swarm cooldowm for all cockroaches
* `CacheClearSwarmCooldown()` clears swarm cooldown
* `CacheGetSwarmCooldown()` checks if swarm is on cooldwon
* `CacheSetCooldown(cockroachId, startTime)` set infanticide cooldown for user with ID `cockroachId`
* `CacheClearInfanticideCooldown(cockroachId)`  clear infanticide coodown for user with ID `cockroachId`
* `CacheGetCooldown(cockroachId)` gets infanticide cooldown for user with ID `cockroachId`
* `CacheSetFesterCooldown(maggotId, startTime)` sets fester cooldown for user with ID `maggotId`
* `CacheClearFesterCooldown(maggotId)` clear fester cooldown for user with ID `maggotId`
* `CacheGetFesterCooldown(maggotId)`  get fester cooldown for user with Id `maggotId`
* `CacheIsPoopBeingFestered(poopId)` check if a user with id `poopId` is being targeted by fester


<a name="botActions"></a>


## __7. botActions.js__

This method contains functions called by most of the bots.

* `changeRole(member, roleName)` changes the role of `member` from his current role to new role `roleName`
* `stopBoosting()` stops the scheduled XP boost
* `scheduledXpBoost(timeUntilNextBoost, client)` starts the periodic XP boost, called on start-up `timeUntilNextBoost` synchronizes with the last boost in the DB.
* `checkAndApplyMissedXPBoost(client)` checks and applies missed boost increments to account for down-time.
* `buildSelectMenu(client,roleNames, customId)` builds a select menu for role `roleName`


<a name="gameConfig"></a>


## __8. game_config.json__

`game_config.json` contains all in-game text along with global values used in game mecahnics which can be tweaked for balancing - it contains abiltiy costs, cooldowns, timer values and `"roleXpThresholds"` - the role hierarchy along with the XP threshold a user needs to pass to get to the next role.

<a name="gameState"></a>


## __9. game_state.json__
`game_state.js` contains global variables that represent the current state of the game, containing data relevant to the status of cross-role abilities - Revolution, Coup & Siege, role sizes and server status.
