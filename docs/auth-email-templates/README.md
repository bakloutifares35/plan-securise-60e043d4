# Modèles d’e-mail Resillia pour Supabase Auth

Ces fichiers sont des modèles locaux à copier manuellement dans le dashboard du projet Supabase qui gère l’Auth Resillia. Ils ne changent aucune configuration Supabase et ne sont pas déployés par l’application.

## Modèle à utiliser

Dans le dashboard du projet principal : Authentication → Email Templates. Remplacez le sujet et le corps du modèle correspondant. Collez le contenu HTML du fichier indiqué :

| Modèle Supabase Auth | Fichier HTML | Sujet suggéré |
| --- | --- | --- |
| Confirm signup | confirmation.html | Confirmez votre adresse e-mail Resillia |
| Invite user | invitation.html | Votre invitation à rejoindre Resillia |
| Reset password | password-reset.html | Réinitialisez votre mot de passe Resillia |
| Change email address | email-change.html | Confirmez votre nouvelle adresse e-mail Resillia |

Les fichiers .txt associés sont des versions lisibles en texte brut pour référence et pour les systèmes d’envoi qui permettent explicitement un corps text/plain. Le gestionnaire de modèles hébergé Supabase documente un corps HTML ; ne collez donc pas le texte brut à la place du HTML dans ce champ.

Les modèles utilisent uniquement des variables Auth documentées. Les principales variables disponibles pour ces flux sont :

- {{ .ConfirmationURL }} : URL de confirmation, invitation ou récupération fournie par Auth ;
- {{ .NewEmail }} : nouvelle adresse, disponible uniquement dans le modèle de changement d’adresse ;
- {{ .SiteURL }} et {{ .RedirectTo }} : disponibles si vous personnalisez ultérieurement les liens ;
- {{ .Email }}, {{ .Token }} et {{ .TokenHash }} : variables Auth disponibles, non nécessaires dans ces modèles.
- {{ .Data }} : métadonnées utilisateur disponibles, volontairement non utilisées ici.

D’autres variables existent pour les notifications de sécurité spécialisées ; consultez la documentation officielle liée ci-dessous pour leur disponibilité par modèle.

Les modèles ne supposent aucun nom d’organisation, rôle, administrateur ou délai. La confirmation de l’adresse n’active pas le compte Resillia : l’accès applicatif continue de dépendre du profil et de la membership active.

## URLs de redirection

Dans Authentication → URL Configuration, vérifiez le Site URL et les URLs autorisées de redirection du projet. Ajoutez les URLs exactes correspondant à chaque environnement déployé, par exemple :

- https://<domaine-de-l-application>/login pour la confirmation d’inscription utilisée par le frontend ;
- https://<domaine-de-l-application>/reset-password pour la récupération du mot de passe ;
- les équivalents locaux ou de préproduction uniquement si ces environnements sont réellement utilisés.

Le frontend actuel demande /login après inscription et /reset-password pour la récupération. N’autorisez pas de wildcard large. Le template Supabase d’invitation utilise la confirmation Auth ; vérifiez le redirect URI de test dans le dashboard et ajustez la liste autorisée si le flux utilisé le demande.

## Vérification manuelle

1. Copiez les quatre HTML et sujets dans les quatre sections correspondantes du dashboard.
2. Vérifiez l’aperçu et envoyez chaque flux à une boîte de test contrôlée : confirmation d’inscription, invitation, récupération, puis changement d’adresse.
3. Ouvrez chaque lien et confirmez que le navigateur arrive sur le bon domaine et la bonne route.
4. Vérifiez que le compte nouvellement confirmé reste en attente tant que son profil et sa membership n’ont pas été activés par l’administrateur.
5. Testez le rendu dans un client desktop et un client mobile, notamment le bouton et le lien alternatif.

La prélecture de liens par certains filtres de messagerie peut consommer une URL de confirmation. Si cela survient, Supabase documente une alternative basée sur OTP ou une page de confirmation intermédiaire ; cela nécessite un parcours applicatif dédié et n’est pas activé par ces modèles.

## Délivrabilité

Pour un pilote client, configurez un fournisseur SMTP professionnel dans les paramètres Auth Supabase, avec un domaine d’envoi vérifié et ses enregistrements SPF, DKIM et DMARC. Utilisez un expéditeur cohérent sur ce domaine, surveillez les rebonds et désactivez le suivi/réécriture des liens pour les messages Auth. N’ajoutez jamais les identifiants SMTP au frontend ou au dépôt.

Le SMTP par défaut de Supabase est prévu pour l’exploration et les tests, avec des restrictions de destinataires et de débit susceptibles d’évoluer. Vérifiez les limites affichées dans le dashboard avant les essais. La configuration SMTP du projet distant reste une étape manuelle ; aucun secret SMTP n’est fourni ni enregistré ici.

## Références Supabase

- https://supabase.com/docs/guides/auth/auth-email-templates
- https://supabase.com/docs/guides/local-development/customizing-email-templates
- https://supabase.com/docs/guides/auth/auth-smtp
