import React, { useEffect, useState } from "react";
import { DEFAULT_LAYOUT } from "./consts";
import { DeckGrid, DeckGridItem, DeckGrids } from "./types";
import uuid from "uuid";
import useLocalStorage from "react-use/lib/useLocalStorage";
import { PREFIX } from "../../util/local-storage";
import { createDeck, deleteDeck, getDecks, updateDeck } from "./deck-api";
import { useMappedStore } from "../../store/use-mapped-store";
import usePrevious from "react-use/lib/usePrevious";
import { error } from "../feedback";

interface Context {
  layout: DeckGrid;
  decks: DeckGrids;
  activeDeck: string;
  add: (column: Omit<DeckGridItem, "id">) => void;
  reOrder: (originalIndex: number, nextIndex: number) => void;
  scrollTo: (key: DeckGridItem["key"]) => void;
  setActiveDeck: (key: string) => void;
  pushOrUpdateDeck: (deck: DeckGrid) => void;
  removeDeck: (deck: DeckGrid) => Promise<void>;
}

export const DeckGridContext = React.createContext<Context>({
  activeDeck: "",
  layout: DEFAULT_LAYOUT[0],
  decks: DEFAULT_LAYOUT,
  add: () => {},
  reOrder: () => {},
  scrollTo: () => {},
  setActiveDeck: () => {},
  pushOrUpdateDeck: () => {},
  removeDeck: () => Promise.resolve()
});

interface Props {
  children: (context: Context) => JSX.Element;
}

export const DeckManager = ({ children }: Props) => {
  const { activeUser } = useMappedStore();
  const [localDecks, setLocalDecks] = useLocalStorage(PREFIX + "_d", DEFAULT_LAYOUT);

  const [decks, setDecks] = useState(
    localDecks && localDecks.decks.length > 0 ? localDecks : DEFAULT_LAYOUT
  );
  const [activeDeck, setActiveDeck] = useState(decks.decks[0].key);
  const [layout, setLayout] = useState(decks.decks[0]);
  const previousLayout = usePrevious(layout);

  useEffect(() => {
    fetchDecks();
  }, []);

  // Save active deck after column re-arrange
  useEffect(() => {
    updateDeckOnLayoutChange();
  }, [layout]);

  useEffect(() => {
    const deck = decks.decks.find((d) => d.key === activeDeck);
    if (deck) {
      setLayout(deck);
    }
  }, [activeDeck]);

  const fetchDecks = async () => {
    if (activeUser) {
      try {
        const accountDecks = await getDecks(activeUser?.username);
        if (accountDecks.length > 0) {
          setDecks({
            decks: [...accountDecks, ...decks.decks]
          });
          setActiveDeck(accountDecks[0].key);
        }
      } catch (e) {
        error("Account decks fetching failed. Please, refresh a page");
      }
    }
  };

  const updateDeckOnLayoutChange = async () => {
    try {
      if (previousLayout?.key === activeDeck) {
        if (activeUser && layout.storageType === "account") {
          await updateDeck(activeUser.username, layout);
        } else {
          const localDecksSnapshot = { decks: [...localDecks?.decks] };
          const existingDeckIndex = localDecksSnapshot.decks.findIndex((d) => d.key === activeDeck);
          if (existingDeckIndex > -1) {
            localDecksSnapshot.decks[existingDeckIndex] = layout;
            setLocalDecks(localDecksSnapshot);
          }
        }
      }
    } catch (e) {
      error("Deck updating failed. Please, try again");
    }
  };

  const getNextKey = () => Math.max(...layout.columns.map((c: DeckGridItem) => c.key)) + 1;

  const add = (column: Omit<DeckGridItem, "id">) => {
    const layoutSnapshot = { ...layout, columns: [...layout.columns] };
    const existingColumnIndex = layoutSnapshot.columns.findIndex((c) => c.key === column.key);
    if (existingColumnIndex > -1) {
      layoutSnapshot.columns[existingColumnIndex] = {
        id: layoutSnapshot.columns[existingColumnIndex].id,
        ...column
      };
    } else {
      column.key = getNextKey();
      layoutSnapshot.columns.push({
        id: uuid.v4(),
        ...column
      });
    }
    setLayout(layoutSnapshot);
  };

  const reOrder = (originalIndex: number, newIndex: number) => {
    if (newIndex === originalIndex) {
      return;
    }

    const hasOriginalIndexColumn = layout.columns[originalIndex] !== undefined;

    if (hasOriginalIndexColumn) {
      const layoutSnapshot = { ...layout, columns: [...layout.columns] };
      const [column] = layoutSnapshot.columns.splice(originalIndex, 1);

      layoutSnapshot.columns.splice(newIndex, 0, column);

      setLayout(layoutSnapshot);
    }
  };

  const scrollTo = (key: number) => {
    document.getElementById(`${key - 1}`)?.scrollIntoView({ behavior: "smooth" });
  };

  // All actions should be transactional
  const pushOrUpdateDeck = async (deck: DeckGrid) => {
    const decksSnapshot = decks.decks;
    const existingDeckIndex = decksSnapshot.findIndex((d) => d.key === deck.key);

    try {
      // Update existing deck
      if (existingDeckIndex > -1) {
        const previousDeck = decksSnapshot[existingDeckIndex];

        // If deck detached from account need to remove it
        if (activeUser && deck.storageType === "local" && previousDeck.storageType === "account") {
          await deleteDeck(activeUser?.username, deck);
        }

        // Save to account is storage is account
        if (
          activeUser &&
          deck.storageType === "account" &&
          previousDeck.storageType === "account"
        ) {
          await updateDeck(activeUser?.username, deck);
        }

        // If deck was local and become account need to create it
        if (activeUser && deck.storageType === "account" && previousDeck.storageType === "local") {
          await createDeck(activeUser?.username, deck);
        }

        // Replacing updating deck
        decksSnapshot[existingDeckIndex] = deck;

        // Save locally if storage is local
        if (deck.storageType === "local") {
          setLocalDecks({ decks: decksSnapshot.filter((d) => d.storageType === "local") });
        }
      } else {
        decksSnapshot.push(deck);

        // Create deck if its doesn't exists
        if (activeUser && deck.storageType === "account") {
          await createDeck(activeUser?.username, deck);
        } else {
          setLocalDecks({ decks: decksSnapshot.filter((d) => d.storageType === "local") });
        }
      }

      setDecks({ decks: decksSnapshot });
    } catch (e) {
      error("Deck creating/updating failed. Please, try again");
    }
  };

  // All actions should be transactional
  const removeDeck = async (deck: DeckGrid) => {
    try {
      if (deck.storageType === "account" && activeUser?.username) {
        await deleteDeck(activeUser?.username, deck);
        setDecks({ decks: decks.decks.filter((d) => d.key !== deck.key) });
      } else {
        setLocalDecks({
          decks: decks.decks.filter((d) => d.key !== deck.key && d.storageType === "local")
        });
        setDecks({ decks: decks.decks.filter((d) => d.key !== deck.key) });
      }

      if (activeDeck === deck.key) {
        const activeDeckIndex = decks.decks.findIndex((d) => d.key === deck.key);
        const isLast = activeDeckIndex === decks.decks.length - 1;
        const nextActiveDeckIndex = isLast ? decks.decks.length - 2 : activeDeckIndex + 1;
        const nextDeck = decks.decks[nextActiveDeckIndex];

        if (nextDeck) {
          setActiveDeck(nextDeck.key);
        }
      }
    } catch (e) {
      error("Deck deletion failed. Please, try again");
    }
  };

  return (
    <DeckGridContext.Provider
      value={{
        decks,
        layout,
        add,
        reOrder,
        scrollTo,
        activeDeck,
        setActiveDeck,
        pushOrUpdateDeck,
        removeDeck
      }}
    >
      {children({
        layout,
        add,
        reOrder,
        scrollTo,
        setActiveDeck,
        activeDeck,
        decks,
        pushOrUpdateDeck,
        removeDeck
      })}
    </DeckGridContext.Provider>
  );
};
