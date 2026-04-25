export interface UnsplashImage {
  id: string;
  url: string;
  thumb: string;
  credit_name: string;
  credit_url: string;
}

export const searchImages = async (keyword: string, count: number = 5): Promise<UnsplashImage[]> => {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    console.warn("UNSPLASH_ACCESS_KEY not found.");
    throw new Error("Missing Unsplash API Key");
  }

  const response = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(keyword)}&per_page=${count}&orientation=squarish`,
    { 
      headers: { Authorization: `Client-ID ${accessKey}` },
    }
  );

  if (!response.ok) {
    throw new Error(`Unsplash API error: ${response.status}`);
  }

  const data = await response.json();
  
  return data.results.map((item: any) => ({
    id: item.id,
    url: item.urls.regular,
    thumb: item.urls.thumb,
    credit_name: item.user.name,
    credit_url: `${item.user.links.html}?utm_source=ankiflow&utm_medium=referral`
  }));
};
