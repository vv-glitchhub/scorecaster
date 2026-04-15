"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "scorecaster_favorites";

export function useFavoritesStore() {
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setFavorites(JSON.parse(raw));
      }
    } catch (error) {
      console.error("Failed to load favorites", error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    } catch (error) {
      console.error("Failed to save favorites", error);
    }
  }, [favorites]);

  function toggleFavorite(item) {
    setFavorites((prev) => {
      const exists = prev.some((fav) => fav.id === item.id);
      if (exists) {
        return prev.filter((fav) => fav.id !== item.id);
      }
      return [...prev, item];
    });
  }

  function isFavorite(id) {
    return favorites.some((fav) => fav.id === id);
  }

  return {
    favorites,
    toggleFavorite,
    isFavorite,
  };
}
