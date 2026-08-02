# SocialFlow AI, cahier des charges et architecture

Version 1.1, 1er août 2026. Document de référence du projet. Nom de produit provisoire : SocialFlow AI.

Nouveauté v1.1 : intégration des sept différenciateurs exclusifs (sections 3.13 à 3.19), avec leurs impacts sur le modèle de données et le phasage.

---

## 1. Vision du produit

SocialFlow AI est un community manager virtuel disponible en permanence. L'utilisateur renseigne son entreprise une seule fois (activité, positionnement, zone, cible, ton, charte graphique, médias, tarifs, horaires, objectifs, concurrents). L'application construit ensuite une stratégie annuelle, la décline en plannings mensuels et hebdomadaires, génère les textes, visuels et vidéos, programme et publie les contenus, répond à la communauté, détecte les prospects et améliore les campagnes grâce aux résultats mesurés.

Premier utilisateur : Chana Thaï (restaurant à emporter à Gif-sur-Yvette et food truck présent sur marchés, campus HEC, festivals et événements privés). Ensuite : les clients de l'agence food truck, puis vente par abonnement aux restaurants, food trucks, commerces et petites entreprises.

### Positionnement face au marché

L'étude concurrentielle (juillet 2026) montre que les outils généralistes (Metricool, Buffer, Later, Hootsuite, Ocoya, Predis.ai, FeedHive) restent des planificateurs avec une couche IA d'assistance à la rédaction. Aucun ne fait la boucle complète stratégie annuelle, plannings, contenus, publication, réponses, prospects. Les outils "autonomes" récents (Blaze.ai, Marky) restent semi-autonomes et souffrent de visuels hors charte et de contenu générique. Le spécialiste français de la restauration, Malou (100 à 140 euros par mois et par établissement), excelle sur le SEO local et les avis mais ne produit pas de contenus de manière autonome.

L'espace de différenciation de SocialFlow AI :

1. Autopilot vertical restauration : stratégie et calendriers calés sur les menus, la saisonnalité, les emplacements et les événements locaux français.
2. Visuels et vidéos crédibles construits à partir des vraies photos du client, jamais de nourriture générée artificiellement.
3. Validation en un geste depuis le mobile, sans système de crédits IA.
4. Boîte de réception unifiée qui transforme les messages en pipeline commercial (devis, privatisations).
5. Français natif, ton local, prix par établissement tout inclus.
6. Plan agence multi-clients avec validation par le client final.

### Frustrations du marché à ne pas reproduire

Contenu IA générique nécessitant réécriture, visuels hors charte, crédits IA opaques, prix qui explose en multi-clients (facturation par canal ou par siège), outils réactifs sans stratégie, inbox peu automatisée, facturation et résiliation opaques.

---

## 2. Utilisateurs et rôles

| Rôle | Description | Exemples |
|---|---|---|
| Propriétaire d'organisation | Crée l'organisation, gère la facturation et les membres | Pierre |
| Administrateur d'agence | Voit tous les clients, pilote les contenus et les validations | Équipe de l'agence |
| Gestionnaire de marque | Gère une ou plusieurs marques, valide et publie | Responsable Chana Thaï |
| Validateur client | Accès restreint : valide ou refuse les contenus de sa marque, commente | Client de l'agence |
| Équipier | Alimente la bibliothèque (photos du service), consulte le planning | Équipe du food truck |

Deux configurations : marque indépendante (une organisation, une ou plusieurs marques à soi) et agence (une organisation, N marques clientes, tableau de bord global, validation par le client final).

### 2.1 Parcours client de bout en bout, tout automatique

Règle produit fondatrice : le client ne configure rien techniquement et ne part jamais d'une page blanche. À chaque étape, l'application a déjà préparé quelque chose ; le client confirme, corrige ou ignore. Objectif chiffré : moins de 15 minutes de travail client par semaine en vitesse de croisière.

**Jour 0, l'inscription (15 minutes, une seule fois).** Le client donne le nom de son entreprise et connecte ses comptes (Instagram, Facebook, Google) en trois clics OAuth. L'application fait le reste seule : lecture du site web et de la fiche Google, analyse des anciennes publications Instagram pour capter le ton et les produits, détection du logo et des couleurs, récupération des photos existantes dans la bibliothèque, préremplissage complet du profil de marque (activité, carte et prix, horaires, zone, cible). Le client ne remplit pas un formulaire : il relit une fiche déjà remplie et répond à une dizaine de questions simples (objectifs, ce qu'il ne veut jamais voir publié, événements à venir). Connexion de la caisse et du calendrier d'emplacements proposées mais optionnelles à ce stade.

**La première heure.** L'application génère la stratégie annuelle, le planning du mois, la première semaine de contenus prêts à partir et la story des emplacements. Le client découvre son tableau de bord déjà vivant et valide sa première semaine en quelques gestes.

**Semaines 1 et 2, l'apprentissage (mode assisté).** Tout est soumis à validation par notification push : un geste pour approuver, un pour corriger. Chaque correction nourrit la voix de la marque (formulations préférées, emojis, sujets à éviter). Environ 5 minutes par jour, qui diminuent chaque jour.

**Ensuite, la vitesse de croisière (mode semi-automatique).** Deviennent invisibles pour le client : la génération et la publication des contenus classiques, la story « on est là » et la story de la semaine, la mise à jour Google selon le lieu, les réponses aux questions simples et aux avis positifs, l'adaptation météo et ruptures, la détection des prospects avec devis préparés et relances, la collecte des statistiques, le rapport mensuel. Il ne reste au client que trois gestes : tendre le téléphone quand l'app demande 4 plans de 5 secondes, valider en un clic ce qui touche à l'argent ou au sensible (promotions, prix, réclamations, allergies), et décider commercialement (accepter un devis, confirmer un événement). Budget temps cible : 10 à 15 minutes par semaine.

**Chaque mois, sans action.** Le rapport arrive prêt à lire (et prêt à transférer pour un client d'agence), le planning du mois suivant est déjà généré en intégrant les résultats du mois écoulé. Le client peut monter en mode autonome quand la confiance est installée, ou rester en semi-automatique.

Ce parcours est aussi celui de la démonstration commerciale : « donnez-nous votre Instagram et votre fiche Google, revenez dans une heure, votre mois est prêt ».

---

## 3. Périmètre fonctionnel

### 3.1 Profil de marque (onboarding)

Assistant de configuration en une session : activité, produits et services, positionnement et valeurs, zone géographique, public cible, ton de communication, couleurs, logos et typographies, photos et vidéos disponibles, tarifs et menus, horaires et lieux de présence, objectifs (visibilité, ventes, réservations, trafic, communauté), concurrents et comptes inspirants. Import possible depuis le site web et le Google Business Profile de l'entreprise pour préremplir. Le profil produit un "brand brief" structuré qui alimente toutes les générations IA, et une liste de produits avec prix qui sert de source de vérité aux contrôles avant publication.

### 3.2 Plannings à trois niveaux

Planning annuel : grandes campagnes (saisons, fêtes et journées importantes, lancements, promotions, événements locaux, vacances scolaires, recrutement, communication institutionnelle, concours, bilans). Généré à partir du profil de marque et d'un référentiel de marronniers français (fêtes nationales, vacances par zone, journées mondiales) enrichi par métier. Pour Chana Thaï : Saint-Valentin, Nouvel An thaï et Songkran, saison des festivals, rentrée HEC, Fête de la musique, marchés de Noël, privatisations estivales, campagnes traiteur mariages et entreprises.

Planning mensuel : thème du mois, produit ou service mis en avant, objectif commercial, nombre de publications, répartition entre Reels, Stories, carrousels et posts, budget publicitaire recommandé, résultat attendu.

Planning hebdomadaire : calendrier complet jour par jour avec contenu, objectif et format. Chaque case du planning est un "slot" qui déclenche la génération du contenu correspondant.

Le planning est entièrement modifiable : déplacer, supprimer, régénérer un slot, ajouter un contenu ponctuel.

### 3.3 Studio de création

Génération à partir du brand brief et des médias de la bibliothèque : publications Instagram et Facebook, Stories, carrousels, scripts de Reels et TikTok, légendes, titres et accroches, appels à l'action, hashtags, visuels publicitaires, affiches événementielles, menus et promotions, newsletters, réponses aux avis, publications Google Business Profile, textes LinkedIn, variantes adaptées à chaque réseau.

Décomposition d'une photo unique : à partir d'une photo de plat, production d'une Story verticale, d'un post Instagram, d'une promotion Facebook, d'un visuel Google, d'une légende courte, d'une légende commerciale, d'un script vidéo et de plusieurs variantes. Règle produit ferme : les photos originales restent la matière première ; l'IA nettoie, recadre, stylise et habille (templates aux couleurs de la marque), elle ne génère pas de faux plats.

Chaque contenu généré propose 2 ou 3 variantes pour éviter la répétition, avec possibilité de régénérer avec consigne ("plus court", "plus commercial", "mentionne le prix").

Zone design haute qualité : espace dédié aux visuels premium (affiches événement, menus, promotions, bâches, visuels réseaux soignés) générés par les moteurs d'image de la section 7 (GPT Image 2, Nano Banana 2, Ideogram) avec la charte appliquée automatiquement. Brief libre, choix du moteur ou mode automatique, duel de moteurs sur un même brief avec apprentissage des préférences, déclinaison en un clic vers Story, Post et visuel Google, export haute définition pour l'impression.

### 3.4 Création vidéo automatisée

Montage automatique de photos et courtes séquences : transitions, sous-titres, musique adaptée, logo animé, prix et offres à l'écran, voix off optionnelle, formats 9:16, 4:5 et 1:1, versions 6, 15 ou 30 secondes, sélection des meilleurs passages. Fonction "liste de tournage" : l'application indique les scènes à filmer (ouverture du camion, cuisson, dressage, réaction client) et l'équipier les dépose depuis son téléphone dans la bibliothèque.

### 3.5 Publication multi-réseaux

Réseaux cibles : Instagram, Facebook, TikTok, LinkedIn, Pinterest, YouTube Shorts, Google Business Profile, Threads, X. La stratégie d'intégration (section 5) tient compte des contraintes réelles de chaque API.

Contrôles automatiques avant chaque publication (pipeline de garde-fous, section 6.4) : prix affiché conforme à la liste de produits, adresse, horaires, format du visuel, orthographe, présence du logo, cohérence avec la charte, absence de produits supprimés, risque juridique ou réputationnel, répétition avec les publications récentes.

### 3.6 Assistant quotidien

Synthèse chaque matin : présences du jour (calendrier des emplacements), contenus préparés, suggestions d'action ("une photo du service de ce soir serait utile"). Signaux exploités : calendrier des emplacements, réservations, événements, ruptures de stock, nouveaux produits, promotions, météo (mise en avant Bubble Tea et Mister Freeze en cas de forte chaleur plutôt que plats chauds), tendances locales, résultats des publications précédentes.

### 3.7 Bibliothèque intelligente

Espace centralisé : photos, vidéos, logos, menus, tarifs, promotions, présentations d'équipe, avis clients, témoignages, anciennes publications, modèles graphiques, musiques autorisées. Étiquetage automatique par IA de vision (Crousty Thaï, Bubble Tea, Food Truck, Traiteur, Équipe) avec correction manuelle. Compteur d'utilisation par média pour éviter la surexploitation des mêmes images. Dépôt rapide depuis mobile (PWA) par l'équipe terrain.

### 3.8 Multi-marques et multi-établissements

Plusieurs marques, établissements, food trucks et clients ; tarifs différents selon les lieux ; plusieurs utilisateurs ; validations par le client ; identité graphique propre à chaque marque. Tableau de bord agence : publications à valider, contenus programmés, comptes inactifs, résultats du mois, alertes, facturation et abonnements.

### 3.9 Boîte de réception et gestion de communauté

Regroupement : messages privés, commentaires, mentions, avis Google, questions fréquentes, demandes de devis, réservations, réclamations. Réponses préparées par l'IA à partir du profil de marque et des données du jour (emplacements, horaires, carte). Réponse automatique possible aux questions simples (où êtes-vous aujourd'hui, horaires, plats végétariens, privatisations, devis). Messages sensibles toujours soumis à validation humaine : réclamation, allergie, incident, remboursement, accusation publique, problème sanitaire. Classification automatique de sensibilité avec seuil prudent : en cas de doute, validation humaine.

### 3.10 Détection des opportunités commerciales

Détection des messages de type demande de prestation (mariage, événement d'entreprise, privatisation, prestation pour N personnes). Création automatique d'une fiche prospect : nom, coordonnées, type d'événement, date, nombre de personnes, budget, statut, relance automatique programmée. Vue pipeline (nouveau, qualifié, devis envoyé, gagné, perdu).

### 3.11 Analyse des performances

Mesures : vues, portée, engagement, abonnés gagnés, clics, messages reçus, demandes de devis, réservations, chiffre d'affaires estimé, meilleurs produits, meilleurs jours et horaires, meilleurs formats, retour sur budget publicitaire. Recommandations concrètes réinjectées dans la génération des plannings suivants (boucle d'apprentissage : les formats et sujets qui performent pèsent plus lourd dans le planning du mois suivant).

### 3.12 Écrans principaux

Tableau de bord général ; calendrier semaine, mois, année ; studio de création ; zone design haute qualité ; bibliothèque de médias ; publications à valider ; boîte de réception sociale ; gestion des avis ; prospects et devis ; analyse des performances ; emplacements ; ventes et retour sur investissement ; SEO et visibilité moteurs IA ; paramètres de la marque ; gestion des équipes et clients ; automatisations.

### 3.13 Connexion caisse et pilotage par les ventes (différenciateur)

Connexion à la caisse du client (Clyo pour Chana Thaï ; import par export de fichiers au départ, API si disponible, autres caisses ensuite). Ce que ça change : le contenu est piloté par les ventes réelles et non par l'intuition. L'application met en avant les produits qui se vendent mal aux heures creuses, retire automatiquement des plannings un produit en rupture ou supprimé de la carte, mesure l'effet d'une publication sur les ventes du produit concerné (fenêtre avant/après) et exprime le retour sur investissement en euros et non en vues. Le rapprochement ventes/publications est présenté avec prudence méthodologique : corrélation datée, jamais causalité garantie. Aucun concurrent identifié (Metricool, Malou, Blaze) ne fait ce lien caisse-contenu.

### 3.14 Moteur d'emplacements (différenciateur)

Le calendrier des emplacements devient la colonne vertébrale de la communication d'un commerce mobile : Story automatique « on est là » à l'ouverture du service avec lieu et horaires, mise à jour du Google Business Profile selon le lieu du jour, réponse automatique aux « vous êtes où ? » en message privé, publication du planning de la semaine le dimanche, alerte si un emplacement du calendrier n'a aucun contenu prévu, gestion des tarifs par lieu. Fonctionne aussi pour un multi-établissements fixe (horaires, fermetures exceptionnelles).

### 3.15 Intelligence locale française (différenciateur)

Référentiels intégrés : météo par zone (bascule automatique boissons fraîches/plats chauds), vacances scolaires par zone A/B/C, jours fériés et marronniers français, événements locaux à proximité des emplacements (fêtes de ville, marchés, festivals, brocantes) via agendas ouverts type OpenAgenda. Les plannings et l'assistant quotidien s'appuient sur ces signaux ; les outils anglo-saxons n'en tiennent aucun compte.

### 3.16 SEO local et visibilité dans les moteurs IA (différenciateur)

Console intégrée reprenant le principe des consoles SEO/GEO existantes de Pierre : suivi du positionnement Google local sur les mots-clés métier (référentiel 400+ mots-clés déjà constitué pour la restauration mobile), santé du Google Business Profile, et visibilité GEO : l'entreprise est-elle citée quand on demande à ChatGPT, Claude ou Gemini « un food truck pour un mariage dans le 91 » ? Les contenus publiés (posts GBP, avis, cohérence des informations) alimentent directement ce référencement, et le rapport mensuel relie les deux mondes : réseaux sociaux et découvrabilité.

### 3.17 CRM événementiel de bout en bout (différenciateur)

Prolongement de la détection de prospects (3.10) : génération du devis à partir d'une grille tarifaire par type de prestation (mariage, entreprise, privatisation, stand bubble tea), envoi et suivi (vu, accepté), relances automatiques à intervalles configurables, transformation en événement confirmé qui alimente à son tour le calendrier de contenu (teaser, couverture le jour J, remerciements). Objectif : que l'application génère du chiffre d'affaires événementiel mesurable, pas seulement de la visibilité.

### 3.18 Mode équipe terrain (différenciateur)

Le jour J, l'application envoie à l'équipier une liste de plans précis à filmer (4 plans de 5 secondes : ouverture, cuisson, dressage, réaction client), avec exemples visuels. L'équipier filme depuis la PWA, les rushes partent dans la bibliothèque, le montage se fait automatiquement dans la nuit et le Reel est proposé à la validation au matin. Le client ne gère plus ses réseaux : il tend son téléphone quelques secondes par service.

### 3.19 Rapport mensuel automatique (différenciateur)

Chaque début de mois, un rapport prêt à envoyer au client final : résultats du mois (vues, engagement, abonnés), euros générés (ventes corrélées, devis signés), meilleurs contenus, actions du community manager IA, plan du mois suivant. Marque blanche pour l'offre agence. C'est l'outil de rétention de l'abonnement et l'argument de vente du plan agence.

---

## 4. Niveaux d'automatisation

| Mode | Comportement |
|---|---|
| Assisté | L'IA crée, l'utilisateur valide tout |
| Semi-automatique | Publications classiques automatiques ; promotions, changements de prix et communications sensibles soumises à validation |
| Autonome | Calendrier, production et publication automatiques dans les limites définies |

Réglages complémentaires : validation obligatoire par type de contenu, mode brouillon, mode absence ou vacances (l'application continue de publier les contenus déjà validés et met en pause le reste). Lancement recommandé en mode semi-automatique. Les règles de basculement en validation humaine sont configurables par marque et s'appliquent en plus du pipeline de garde-fous, jamais à sa place.

---

## 5. Contraintes externes : APIs des réseaux sociaux (état vérifié juillet 2026)

Synthèse des capacités et contraintes réelles, qui conditionne l'architecture d'intégration.

| Plateforme | Publication | Interaction | Accès | Coût |
|---|---|---|---|---|
| Instagram | Oui : posts, Reels, carrousels, Stories. 100 posts par 24 h | Commentaires oui ; DM via Messenger Platform, fenêtre de 24 h | App Review Meta, Advanced Access, vérification business, 2 à 7 jours ouvrés par permission | Gratuit |
| Facebook Pages | Oui : posts, Reels, Stories de Page | Commentaires et Messenger, fenêtre 24 h | Même App Review Meta | Gratuit |
| TikTok | Oui, mais contenu forcé en privé tant que l'app n'est pas auditée. Pas de Stories | Pas de DM ; commentaires réservés à des programmes restreints | Audit obligatoire, plusieurs semaines | Gratuit |
| LinkedIn | Oui (pages entreprise). Pas de stories | Commentaires oui, pas de DM | Le plus lourd : entité légale, vérifications, 1 à 4 semaines par étape | Gratuit |
| Google Business Profile | Oui : Local Posts, offres, événements | Avis : lecture et réponse. Pas de messagerie | Formulaire d'accès obligatoire, environ 2 semaines | Gratuit |
| Pinterest | Oui, mais sandbox privée en Trial access ; Standard access sur dossier | Non | Quelques jours à quelques semaines | Gratuit |
| YouTube Shorts | Oui via Data API ; vidéos privées tant que l'app n'est pas vérifiée ; 100 uploads par jour max par défaut | Commentaires oui | Audit et extension de quota, plusieurs semaines | Gratuit (quota) |
| Threads | Oui : texte, images, vidéos, carrousels ; 250 posts par 24 h | Réponses oui, pas de DM | App Review Meta allégée | Gratuit |
| X | Oui mais payant à l'usage (environ 0,015 dollar par post, 0,20 dollar avec lien) | Limité selon tier | Compte développeur payant | Payant |

### Stratégie d'intégration retenue

Phase MVP : passer par un agrégateur pour publier vite sur tous les réseaux sans subir six processus d'app review. Deux options : Ayrshare (le plus complet, publication plus commentaires, DM et avis, 149 à 599 dollars par mois selon le nombre de profils) ou Late (moins cher, environ 3 à 6 dollars par compte connecté et par mois). Choix recommandé : Ayrshare si l'inbox est dans le MVP, sinon Late pour le budget.

En parallèle, dès la semaine 1 : lancer la vérification business Meta, le formulaire d'accès Google Business Profile et l'audit TikTok. Ce sont les chemins critiques (2 à 6 semaines).

Cible : intégration directe Meta (Instagram, Facebook, Threads) et Google Business Profile, qui couvrent l'essentiel de la valeur pour la restauration, l'agrégateur restant pour TikTok, LinkedIn, Pinterest et YouTube. X est ignoré au lancement ou facturé en option.

Couche d'abstraction obligatoire dans le code : une interface unique de publication (PublishingProvider) avec deux implémentations, agrégateur et APIs directes, pour migrer réseau par réseau sans toucher au reste de l'application.

Contraintes produit issues des APIs : la réponse automatique aux DM doit respecter la fenêtre de 24 heures de Meta ; les quotas (100 posts Instagram par 24 h par compte) sont sans impact pour des restaurants ; les Stories ne sont pas disponibles partout (Instagram et Facebook oui, TikTok non, LinkedIn non).

---

## 6. Architecture technique

### 6.1 Stack retenue

Cohérente avec les projets existants (écosystème JavaScript, GitHub, déploiement Vercel ou Netlify, applications web installables) :

| Brique | Choix | Justification |
|---|---|---|
| Frontend et API | Next.js (React, TypeScript), déployé sur Vercel via GitHub | Même flux de travail que les projets actuels ; un seul framework pour l'interface et les routes API |
| Base de données, auth, stockage | Supabase, région Union européenne (Postgres, Auth, Storage) | Postgres avec Row Level Security pour l'isolation entre clients ; auth et stockage de médias intégrés ; hébergement UE pour le RGPD |
| Tâches de fond et planification | Trigger.dev (ou Inngest) | Publication à heure programmée, files de génération, relances, synchronisation inbox, rendus vidéo : indispensables et mal servis par des fonctions serverless seules |
| Application mobile terrain | PWA installable (même approche que l'app de commande) | Validation en un geste, dépôt de photos, notifications push |
| Paiement | Stripe Billing | Abonnements par établissement, plans agence |
| Publication sociale | Couche PublishingProvider : Ayrshare ou Late au départ, Meta et Google en direct ensuite | Section 5 |
| IA | Voir section 7 | |

### 6.2 Composants applicatifs

1. App web Next.js : tous les écrans, y compris la PWA mobile (validation, dépôt de médias, synthèse du matin).
2. Moteur de stratégie : génération des plannings annuel, mensuel, hebdo à partir du brand brief, du référentiel de marronniers, des données locales (emplacements, météo) et des performances passées.
3. Moteur de contenu : génération des textes et orchestration des visuels et vidéos pour chaque slot du planning.
4. Pipeline de publication : garde-fous, programmation, envoi via PublishingProvider, suivi des statuts, reprise sur échec.
5. Moteur d'inbox : ingestion des messages, commentaires et avis (webhooks ou polling), classification (simple, sensible, opportunité), brouillons de réponse, envoi.
6. Moteur d'analytics : collecte quotidienne des métriques, agrégats, recommandations, réinjection dans le moteur de stratégie.
7. Worker médias : étiquetage IA des photos, génération de variantes de formats, rendus vidéo.

### 6.3 Multi-tenant et sécurité

Isolation par organisation puis par marque : chaque table porte organization_id et, quand pertinent, brand_id ; Row Level Security Postgres activée partout, les policies vérifiant l'appartenance et le rôle du membre. Aucun accès inter-organisations possible au niveau base.

Secrets et tokens : les tokens OAuth des comptes sociaux sont chiffrés au repos (coffre applicatif, clés hors base), jamais exposés au frontend, rafraîchis par les workers. Les clés des APIs IA et de l'agrégateur vivent dans les variables d'environnement serveur.

RGPD : hébergement des données en UE, registre des sous-traitants (Supabase, Vercel, Anthropic ou OpenAI, agrégateur, Stripe), mentions et DPA, minimisation des données prospects (nom, contact, événement), durées de rétention définies (messages et métriques), export et suppression sur demande, consentement explicite du client final d'agence pour la connexion de ses comptes sociaux.

Journal d'audit : toute publication, validation, réponse automatique et modification de prix est tracée (qui, quoi, quand), indispensable en mode autonome et pour les litiges d'agence.

### 6.4 Pipeline de garde-fous avant publication

Ordre d'exécution pour chaque contenu prêt à partir :

1. Contrôles factuels déterministes (code, pas IA) : prix mentionnés comparés à la table des produits, adresse et horaires comparés au profil, produits supprimés détectés, format et dimensions du média vérifiés.
2. Contrôles de marque : présence du logo si le template l'exige, palette conforme, orthographe (correcteur puis relecture LLM).
3. Contrôle de répétition : similarité avec les N dernières publications (embeddings), rejet si trop proche.
4. Contrôle de risque : classification LLM du risque juridique, réputationnel ou sanitaire ; tout signalement force la validation humaine quel que soit le mode.
5. Routage : selon le mode d'automatisation et les règles de la marque, publication directe ou mise en file de validation avec notification push.

Un échec à n'importe quelle étape bloque la publication et crée une tâche visible, jamais de publication silencieusement dégradée.

### 6.5 Modèle de données (tables principales)

| Table | Contenu clé |
|---|---|
| organizations | Tenant (agence ou marque indépendante), plan, facturation |
| users, memberships | Utilisateurs, rôle par organisation et par marque |
| brands | Profil de marque : activité, positionnement, ton, cible, zone, objectifs, concurrents, brand brief structuré |
| brand_identities | Couleurs, logos, typographies, templates graphiques |
| locations | Établissements et food trucks, horaires, adresses |
| location_schedule | Calendrier des emplacements et présences |
| products | Produits, prix par lieu, statut actif ou supprimé (source de vérité des garde-fous) |
| social_accounts | Comptes connectés, plateforme, tokens chiffrés, statut, mode (agrégateur ou direct) |
| media_assets | Bibliothèque : fichier, type, étiquettes IA, compteur d'utilisation, droits musique |
| campaigns | Planning annuel : campagne, période, objectif |
| monthly_plans | Déclinaison mensuelle : thème, objectifs, volumes, budget pub |
| content_slots | Slots hebdomadaires : date, format, objectif, statut |
| posts | Contenu maître généré : texte, médias, statut (brouillon, à valider, programmé, publié, échec), résultats des garde-fous |
| post_variants | Variante par plateforme et format, identifiant externe après publication |
| inbox_messages | Messages, commentaires, avis : source, auteur, classification, sensibilité |
| reply_drafts | Réponses préparées, statut (auto-envoyée, validée, refusée) |
| leads | Prospects : type d'événement, date, personnes, budget, statut, relances |
| post_metrics, account_metrics | Métriques quotidiennes par publication et par compte |
| recommendations | Recommandations générées et leur application aux plannings suivants |
| automation_settings | Mode par marque, règles de validation par type de contenu |
| audit_log | Trace de toutes les actions sensibles |
| subscriptions | Abonnements Stripe, quotas du plan |
| pos_sales | Ventes agrégées par produit, jour et lieu, importées de la caisse (Clyo puis autres) |
| quotes | Devis : lignes, montant, statut (envoyé, vu, accepté), relances |
| field_requests | Demandes terrain du jour : plans à filmer, statut, rushes reçus |
| local_signals | Météo, vacances scolaires, jours fériés, événements locaux par zone |
| seo_snapshots | Relevés de positionnement Google, santé GBP et visibilité moteurs IA par mot-clé |
| monthly_reports | Rapports mensuels générés, envoi et consultation par le client |

---

## 7. Stack IA et coûts (état vérifié juillet 2026)

| Besoin | Choix MVP | Coût indicatif |
|---|---|---|
| Textes (légendes, scripts, réponses, plannings) | Claude Haiku 4.5 pour le volume, Sonnet pour la stratégie et les newsletters | 0,003 à 0,01 dollar par publication : négligeable |
| Retouche photo produit | Gemini Flash Image (édition qui préserve le plat réel) | Environ 0,07 dollar par image |
| Habillage et déclinaisons de formats | Templates programmatiques Templated.io (photo réelle plus textes injectés, charte garantie) | 29 à 79 dollars par mois, environ 0,03 dollar par visuel |
| Design et affiches premium (texte intégré, mise en page) | GPT Image 2 (OpenAI) | 0,03 à 0,06 dollar par image en usage courant |
| Affiches avec texte intégré (alternative) | Ideogram 3.0 | 0,03 à 0,09 dollar par image |
| Montage vidéo automatique | Shotstack ou JSON2Video (diaporamas, sous-titres, musique, multi-formats) | 0,10 à 0,20 dollar par vidéo de 30 secondes |
| Sous-titres | gpt-4o-mini-transcribe ou équivalent | 0,003 dollar par minute |
| Musique libre de droits | Mubert API (mutualisée entre clients) | 49 à 199 dollars par mois selon volume |
| Génération vidéo IA (option premium) | Veo Fast, 1 à 2 clips par mois par client | Environ 1,20 dollar par clip de 8 secondes |
| Étiquetage des photos | Modèle de vision (Claude ou GPT) | Négligeable |

Principes : jamais de génération pure d'images de nourriture ; la photo réelle est retouchée puis habillée par template. Le texte est quasi gratuit, l'image bon marché, la vidéo générative reste une option premium.

Couche d'abstraction ImageProvider : comme pour la publication, l'application ne dépend d'aucun fournisseur d'images unique. GPT Image 2 (OpenAI) pour le design, les affiches et les visuels avec texte ; Gemini (Nano Banana 2) pour l'édition de photos existantes avec préservation du plat réel et les compositions multi-images (jusqu'à 14 images de référence) ; Ideogram en alternative. Le système peut tester deux fournisseurs sur le même brief et apprendre lequel donne les meilleurs résultats par type de visuel. La règle de marque s'applique à tous : ces modèles éditent et habillent les vraies photos, ils ne génèrent jamais de faux plats.

Coût IA marginal estimé pour un client type (30 posts avec visuels, 8 vidéos courtes, réponses communautaires) : 15 à 30 dollars par mois. Les abonnements fixes mutualisés (Templated, Mubert, agrégateur) s'amortissent à partir de 5 à 10 clients.

---

## 8. Phasage du développement

### Phase 0, fondations et démarches (semaines 1 à 2)

Dépôt GitHub, projet Next.js et Supabase, auth multi-tenant avec RLS, squelette des écrans. En parallèle, actions administratives critiques : vérification business Meta, formulaire d'accès Google Business Profile, dossier d'audit TikTok, compte agrégateur. Décision du nom définitif et du domaine.

### Phase 1, cœur de valeur (semaines 3 à 8)

Onboarding profil de marque, bibliothèque de médias avec étiquetage IA, plannings annuel, mensuel et hebdo générés, génération de textes avec variantes, écran de validation mobile (PWA), publication Instagram, Facebook et Google Business Profile via agrégateur, garde-fous déterministes (prix, horaires, produits supprimés). S'ajoutent dès cette phase le moteur d'emplacements (Story « on est là », planning de semaine, réponse « vous êtes où ? ») et l'intelligence locale de base (météo, vacances, fériés), car ils portent la valeur quotidienne pour un food truck. Pilote réel : Chana Thaï en mode assisté puis semi-automatique. Critère de sortie : quatre semaines de publications réelles sans erreur factuelle.

### Phase 2, studio visuel et analytics (semaines 9 à 14)

Pipeline visuel complet (retouche photo, templates, déclinaisons de formats), affiches promo, extension des réseaux (TikTok, LinkedIn, Threads, Pinterest), collecte des métriques et tableau de bord d'analyse, garde-fous complets (répétition, risque, marque). S'ajoute l'import des ventes caisse (export Clyo d'abord, API si disponible) avec la vue ventes et retour sur investissement dans l'analyse, et le retrait automatique des produits en rupture des plannings.

### Phase 3, vidéo, inbox et prospects (semaines 15 à 20)

Montage vidéo automatique multi-formats et mode équipe terrain complet (plans à filmer le jour J, rushes depuis la PWA, Reel monté dans la nuit), boîte de réception unifiée avec brouillons IA et réponses automatiques aux questions simples, classification des messages sensibles, CRM événementiel complet : détection des opportunités, fiches prospects, génération de devis depuis la grille tarifaire, relances automatiques, assistant quotidien (emplacements, météo, suggestions).

### Phase 4, plateforme commerciale (à partir de la semaine 21)

Tableau de bord agence multi-clients, validation par le client final, facturation Stripe, boucle d'apprentissage sur les performances, mode autonome encadré, migration progressive vers les APIs directes Meta et Google, site vitrine et onboarding en libre-service. S'ajoutent le rapport mensuel automatique en marque blanche et la console SEO et visibilité moteurs IA intégrée (positions Google locales, santé GBP, citations dans ChatGPT, Claude et Gemini), reliée aux contenus publiés.

Chaque phase se termine par une revue : tests, contrôle des garde-fous, validation sur le compte pilote avant élargissement.

---

## 9. Coûts et modèle économique

### Coûts de fonctionnement estimés

| Poste | Mensuel estimé |
|---|---|
| Vercel Pro | 20 dollars |
| Supabase Pro (UE) | 25 dollars |
| Trigger.dev ou Inngest | 0 à 50 dollars au départ |
| Agrégateur (Ayrshare Launch ou Late) | 60 à 300 dollars selon option et volume |
| Templated.io | 29 à 79 dollars |
| Mubert API | 49 à 199 dollars (à partir de la phase 3) |
| IA variable | 15 à 30 dollars par client actif |

Ordre de grandeur : 150 à 400 euros par mois de coûts fixes au lancement, plus le variable par client. Point mort atteint avec une poignée d'abonnés.

### Tarification envisagée (à valider en phase 4)

| Plan | Prix indicatif | Contenu |
|---|---|---|
| Solo | 49 à 79 euros par mois par établissement | Autopilot contenu et publication, validation mobile, avis |
| Premium | 99 à 129 euros par mois | Ajoute vidéos, inbox complète, prospects, assistant quotidien |
| Agence | 199 à 299 euros par mois | 5 à 10 établissements inclus, puis 25 à 35 euros par établissement, validation client, marque blanche |

Positionnement entre Metricool (environ 25 euros, sans autopilot) et Malou (100 à 140 euros, sans création autonome). Pas de crédits IA, pas de facturation par canal.

---

## 10. Risques et points de vigilance

| Risque | Impact | Parade |
|---|---|---|
| Délais d'app review (Meta, TikTok, Google, LinkedIn) | Retard des intégrations directes | Agrégateur au lancement, démarches lancées dès la semaine 1 |
| Dépendance à l'agrégateur (coût, panne, conditions) | Marge et continuité | Couche PublishingProvider, migration progressive vers les APIs directes |
| Erreur factuelle publiée (prix, horaires) | Confiance client | Garde-fous déterministes sur la source de vérité produits, mode semi-automatique par défaut |
| Contenu inapproprié publié en mode autonome | Réputation | Classification de risque bloquante, journal d'audit, validation forcée des sujets sensibles |
| Qualité des visuels IA jugée artificielle | Cœur de la promesse | Photos réelles obligatoires, templates, tests avec Chana Thaï avant tout client externe |
| Réponses automatiques hors fenêtre de 24 h Meta | Rejet en app review, blocage | Règles de fenêtre codées dans le moteur d'inbox |
| RGPD (données prospects, sous-traitants hors UE) | Juridique | Hébergement UE, registre, DPA, rétention, consentements |
| Changements de politique des plateformes | Fonctionnalités retirées | Veille, architecture modulaire par réseau, pas de promesse commerciale sur un réseau unique |
| Périmètre trop large au lancement | Épuisement, retard | Phasage strict, critère de sortie de phase, Chana Thaï comme juge de paix |
| Accès aux données de caisse (Clyo sans API publique documentée) | Différenciateur ventes retardé | Démarrer par les exports de fichiers Clyo, contacter l'éditeur, architecture prête pour d'autres caisses |
| Corrélation ventes/publications surinterprétée | Promesses trompeuses | Présentation prudente (corrélation datée), fenêtres avant/après, jamais de garantie chiffrée |

---

## 11. Actions immédiates recommandées

1. Valider ce cahier des charges et le nom de travail.
2. Lancer les démarches longues : vérification business Meta, formulaire Google Business Profile, préparation du dossier TikTok.
3. Choisir l'agrégateur (Ayrshare si inbox au MVP, Late sinon) et ouvrir le compte.
4. Créer le dépôt GitHub et initialiser le projet (phase 0).
5. Rassembler la matière Chana Thaï : photos, logos, charte, carte et prix à jour, calendrier des emplacements (beaucoup existe déjà : carte food truck, poké bowls, checklists, mots-clés SEO).

---

Document établi le 1er août 2026 à partir de recherches datées de juillet et août 2026 sur les APIs des plateformes sociales, les solutions IA de génération de contenu et le paysage concurrentiel. Les prix cités sont indicatifs et à revérifier au moment des choix d'abonnement.
