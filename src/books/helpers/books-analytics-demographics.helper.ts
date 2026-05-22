import { Application } from '../../applications/entity/application.entity';
import { User } from '../../users/entity/user.entity';
import { UserAddress } from '../../user-address/entity/user-address.entity';
import { UserGenrePreference } from '../../user-genre-preferences/entity/user-genre-preference.entity';
import { BookGenre } from '../entity/book-genre.entity';

export function calculateAgeDemographics(readers: User[]) {
  const now = new Date();
  const ages: number[] = [];

  readers.forEach((reader) => {
    if (reader.birthDate) {
      const birthDate = new Date(reader.birthDate);
      const age = now.getFullYear() - birthDate.getFullYear();
      const monthDiff = now.getMonth() - birthDate.getMonth();
      const adjustedAge =
        monthDiff < 0 ||
        (monthDiff === 0 && now.getDate() < birthDate.getDate())
          ? age - 1
          : age;
      if (adjustedAge > 0 && adjustedAge < 120) {
        ages.push(adjustedAge);
      }
    }
  });

  if (ages.length === 0) {
    return {
      averageAge: 0,
      ageRanges: [],
    };
  }

  const averageAge = Math.round(
    ages.reduce((sum, age) => sum + age, 0) / ages.length,
  );

  const ranges = [
    { label: '13-17', min: 13, max: 17 },
    { label: '18-24', min: 18, max: 24 },
    { label: '25-34', min: 25, max: 34 },
    { label: '35-44', min: 35, max: 44 },
    { label: '45-54', min: 45, max: 54 },
    { label: '55-64', min: 55, max: 64 },
    { label: '65+', min: 65, max: 200 },
  ];

  const ageRanges = ranges
    .map((range) => {
      const count = ages.filter(
        (age) => age >= range.min && age <= range.max,
      ).length;
      const percentage =
        ages.length > 0 ? Math.round((count / ages.length) * 100) : 0;
      return {
        range: range.label,
        count,
        percentage,
      };
    })
    .filter((range) => range.count > 0);

  return {
    averageAge,
    totalWithAge: ages.length,
    ageRanges,
  };
}

export function calculateCountryBreakdown(
  addresses: UserAddress[],
  totalReaders: number,
) {
  const countryCounts = new Map<string, number>();

  addresses.forEach((addr) => {
    const country = addr.country || 'Unknown';
    const count = countryCounts.get(country) || 0;
    countryCounts.set(country, count + 1);
  });

  const countries = Array.from(countryCounts.entries())
    .map(([country, count]) => ({
      country,
      count,
      percentage:
        totalReaders > 0 ? Math.round((count / totalReaders) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalWithCountry: addresses.length,
    countries,
  };
}

export function calculateGenreBreakdown(
  preferences: UserGenrePreference[],
  totalReaders: number,
) {
  const genreCounts = new Map<string, number>();
  const readerGenreSet = new Map<string, Set<string>>();

  preferences.forEach((pref) => {
    if (pref.genre && pref.user) {
      const genreName = pref.genre.name;
      const userId = typeof pref.user === 'object' ? pref.user.id : pref.user;

      if (!readerGenreSet.has(genreName)) {
        readerGenreSet.set(genreName, new Set());
      }
      readerGenreSet.get(genreName)!.add(userId);
    }
  });

  readerGenreSet.forEach((readers, genre) => {
    genreCounts.set(genre, readers.size);
  });

  const genres = Array.from(genreCounts.entries())
    .map(([genre, count]) => ({
      genre,
      count,
      percentage:
        totalReaders > 0 ? Math.round((count / totalReaders) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalWithPreferences: new Set(
      preferences.map((p) =>
        typeof p.user === 'object' ? p.user.id : p.user,
      ),
    ).size,
    genres,
  };
}

export function calculateAppliedBookGenresBreakdown(
  bookGenres: BookGenre[],
  applications: Application[],
  totalReaders: number,
) {
  const genreCounts = new Map<string, number>();
  const readerGenreSet = new Map<string, Set<string>>();

  const bookGenreMap = new Map<string, string[]>();
  bookGenres.forEach((bg) => {
    if (bg.genre) {
      const genres = bookGenreMap.get(bg.bookId) || [];
      genres.push(bg.genre.name);
      bookGenreMap.set(bg.bookId, genres);
    }
  });

  applications.forEach((app) => {
    const genres = bookGenreMap.get(app.bookId) || [];
    genres.forEach((genreName) => {
      if (!readerGenreSet.has(genreName)) {
        readerGenreSet.set(genreName, new Set());
      }
      readerGenreSet.get(genreName)!.add(app.readerId);
    });
  });

  readerGenreSet.forEach((readers, genre) => {
    genreCounts.set(genre, readers.size);
  });

  const genres = Array.from(genreCounts.entries())
    .map(([genre, count]) => ({
      genre,
      count,
      percentage:
        totalReaders > 0 ? Math.round((count / totalReaders) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    genres,
  };
}
