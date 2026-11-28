# For parents

You have one parent account for the whole family and add a profile for each kid. You sign in once per device. After that, your kids pick their own profile and you unlock the parent area with your password when you need it.

## Get an account
- **Invitation:** open the link from the invitation (it is valid for 7 days), choose a password and accept the privacy policy and the terms of use. The account is ready right away.
- **Registration:** if the site has open registration, choose **Create a parent account**, enter your email address and a password, confirm that you are human and accept the privacy policy and the terms. Then click the link in the confirmation email (valid for 48 hours). You can sign in once the address is confirmed.

Passwords need at least 10 characters. A sentence of several words is easy to remember and hard to guess.

## The profile picker
After you sign in, the device shows **Who's learning today?** with a tile for each kid. Tap a tile to start learning as that kid. Tiles with a lock icon need the kid's picture PIN.

- **Add profile** creates a new kid profile (up to 8).
- **Parents** opens the parent area. It asks for your password unless you unlocked it a moment ago.
- The menu at the top right (person icon) has **Profiles**, **Parent area**, **Administration** (admins only) and **Sign out**.
- **DE / EN** at the top right switches the language of the parent screens. While you are signed in, the choice is saved to your account, the same as **Language** in **Parent area → Account**, and the device keeps it for the sign-in page. It does not change a kid's learning language.

A device stays signed in for up to 30 days of inactivity, so you can leave a tablet signed in for your kids.

## The parent area
The parent area is where you manage kid profiles and your account. It is behind a parent gate: signing in unlocks it, and later Murmeli asks for your password again. An unlock lasts 10 minutes while you are active and at most 30 minutes after you entered the password. Opening a kid profile locks it right away.

Before you hand the device to a kid, select **Lock parent area**, or simply open the kid's profile.

After 5 wrong passwords within 5 minutes, the parent gate stays locked for 5 minutes.

## Create a kid profile
Go to **Parent area → Kids → Add profile**.

| Field | What to choose |
|---|---|
| **Avatar** | Build a funny avatar: one of 30 Alpine animals, an optional accessory and a background color. Kids recognize their profile by it. There are no photos. |
| **Nickname** | Up to 20 letters, digits, spaces or hyphens. No real name needed; it is only shown on this account. |
| **Starting level** | Kindergarten 1, Kindergarten 2, 1st grade or 2nd grade. Murmeli opens all worlds below this level, so your kid doesn't have to replay what they already know. See [start-class placement](../learning/curriculum.md#start-class-placement). |
| **Learning language** | Deutsch (de-CH) or English (en-US). It sets the language of the learning area and which subjects appear: math in both, "Lesen und Schreiben" in German, "Reading and Phonics" in English. |
| **Picture PIN** | **No PIN**, or **Set a PIN**: pick 4 of 9 pictures in an order your kid can remember, then tap them again to confirm. Pictures may repeat. |
| **Daily learning time** | No limit, or 15 to 120 minutes per day. |
| **Read aloud** | **Automatic by level** reads every prompt aloud for kindergarten kids (starting level Kindergarten 1 or 2), and only on request for school kids. **Always read aloud** and **Never read aloud** override that. The speaker button next to a text always works. |
| **Sounds and music** | The short sounds for right and wrong answers, stars and finished rounds. |

Select **Save**. The profile appears in the picker.

The picture PIN keeps siblings from opening each other's profile by accident. It doesn't protect against adults. After 5 wrong tries within 15 minutes the profile takes a short break; repeated breaks on the same day get longer.

### The daily learning time
Murmeli adds up the time a kid spends answering exercises each day (the day ends at midnight in the server's `APP_TIMEZONE`, default Europe/Zurich). The limit is checked when a round starts or continues after a reload, so a round that is already running can be finished as long as the page stays open. Once the limit is reached, a new round shows a sleeping Murmeli ("That's enough learning for today. See you tomorrow!") with a button back to the profiles. The next day the time starts again.

## Edit or delete a profile
In **Parent area → Kids**, select the pencil icon to change any setting, including the PIN (**Keep PIN**, **Change PIN** or **No PIN**). Changing the starting level or the language keeps the progress.

The bin icon deletes the profile with all its learning progress, for good.

## Progress
In **Parent area → Kids**, select **Progress** on a kid's card. The page shows:
- **Overview:** stars, levels passed, learning time and rounds in the last 14 days, and earned badges.
- **Last 14 days:** minutes and rounds per day as charts. **Show values as a table** lists the same numbers.
- **Practice ground:** what your kid practiced by choice (see [Practice](kids.md#practice)). At the top are the last 14 days: exercises, the share right on the first try, and days with practice. Below it, each topic your kid practiced shows:
  - its current **step** out of the steps reachable now (the trail plus up to 2 steps ahead), with the total number of steps;
  - the exercises and the share right on the first try in the last 14 days, the totals, and when it was last practiced;
  - its **open mistakes**: up to 5 exercises Murmeli will ask again, as question and right answer ("Wie viel ist 8 plus 7? → 15"), with how often each was missed. Mistakes from trail levels are listed here too.

  Topics marked **Ahead of the trail** are ones your kid tried before the trail reached them. Exercises shown again at the end of a round are not counted.
- **Skills:** each skill with its confidence as a bar, a percentage and a word ("needs practice", "getting there", "solid"), plus when it comes up for review. Skills that need practice are listed first.
- **Learning paths:** every world and level with its stars, state and number of rounds.

There are no streaks, and nothing is lost when your kid skips a day. The data download (below) contains the same progress.

## Your account
**Parent area → Account** has these sections:

- **Language and theme:** the language of the parent screens and of the emails Murmeli sends you, and a light, dark or automatic theme. Each kid profile has its own learning language, which the learning area always uses.
- **Change password:** enter your current and a new password. All other devices are signed out, and you get an email saying the password was changed.
- **Change email address:** enter the new address and your password. Murmeli sends a confirmation link to the new address, and the change only applies once you click it. Your old address is told about the change. This needs email to be set up on the server.
- **Two-factor sign-in:** select **Set up**, scan the QR code with an authenticator app (or type the key), enter the 6-digit code and select **Turn on**. Murmeli shows 10 recovery codes once: download them and keep them safe. Each works once if you lose your phone. **Create new codes** replaces them. To turn two-factor sign-in off, you need your password and a current code or a recovery code.
- **Your data:** **Download data** saves everything Murmeli stores about your account and your kid profiles as a JSON file: the account, the profiles, and per kid the level progress, the skill mastery, the daily learning time, the badges, the practice steps and practice days, the mistakes Murmeli will ask again, and a summary of the answers per skill.
- **Delete account:** enter your password, select **Delete account** and type `DELETE` to confirm. Your account, all kid profiles and all progress are deleted immediately and for good. The audit log keeps an entry that an account was deleted, without any reference to you. The last remaining administrator can't delete their account.

## Forgot your password?
Select **Forgot your password?** on the sign-in page and enter your email address. The link in the email is valid for one hour. After the reset, all devices are signed out. This needs email to be set up on the server; otherwise ask the person who runs the site.
