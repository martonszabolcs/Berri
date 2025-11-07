  export const getFruitName = (type: string) => {
    switch (type) {
      case '1':
        return 'Cherry';
      case '2':
        return 'Ananas';
      case '3':
        return 'Apple';
      case '4':
        return 'Banana';
      case '5':
        return 'Orange';
      case '6':
        return 'Melone';
      case '7':
        return 'Grapes';
      default:
        return 'Unknown Fruit';
    }
  };

    export const getDestinationName = (dest: any) => {
      if (dest?.destination && dest.destination !== 'email') {
        return (
          dest.destination.charAt(0).toUpperCase() + dest.destination.slice(1)
        );
      }
      return getFruitName(dest?.type?.toString() || '1');
    };

    type DestinationType = 'Google Drive' | 'Dropbox' | 'OneDrive' | 'Email';

    export const destinations: DestinationType[] = [
    'Google Drive',
    'Dropbox',
    'OneDrive',
    'Email',
  ];