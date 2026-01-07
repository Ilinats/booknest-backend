import { MigrationInterface, QueryRunner } from "typeorm";

export class InsertGenres1767814230395 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            INSERT INTO genres (name) VALUES
            ('Art'),
            ('Biography'),
            ('Business'),
            ('Chick Lit'),
            ('Children''s'),
            ('Christian'),
            ('Classics'),
            ('Comics'),
            ('Contemporary'),
            ('Cookbooks'),
            ('Crime'),
            ('Ebooks'),
            ('Fantasy'),
            ('High Fantasy'),
            ('Low Fantasy'),
            ('Urban Fantasy'),
            ('Dystopian'),
            ('Fiction'),
            ('Graphic Novels'),
            ('Historical Fiction'),
            ('History'),
            ('Horror'),
            ('Humor and Comedy'),
            ('Manga'),
            ('Memoir'),
            ('Music'),
            ('Mystery'),
            ('Nonfiction'),
            ('Paranormal'),
            ('Philosophy'),
            ('Poetry'),
            ('Psychology'),
            ('Religion'),
            ('Romance'),
            ('Romantic Comedy'),
            ('Romantasy'),
            ('Science'),
            ('Science Fiction'),
            ('Self Help'),
            ('Suspense'),
            ('Spirituality'),
            ('Sports'),
            ('Thriller'),
            ('Travel'),
            ('Young Adult')
            ON CONFLICT (name) DO NOTHING;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DELETE FROM genres WHERE name IN (
                'Art',
                'Biography',
                'Business',
                'Chick Lit',
                'Children''s',
                'Christian',
                'Classics',
                'Comics',
                'Contemporary',
                'Cookbooks',
                'Crime',
                'Ebooks',
                'Fantasy',
                'High Fantasy',
                'Low Fantasy',
                'Urban Fantasy',
                'Dystopian',
                'Fiction',
                'Graphic Novels',
                'Historical Fiction',
                'History',
                'Horror',
                'Humor and Comedy',
                'Manga',
                'Memoir',
                'Music',
                'Mystery',
                'Nonfiction',
                'Paranormal',
                'Philosophy',
                'Poetry',
                'Psychology',
                'Religion',
                'Romance',
                'Romantic Comedy',
                'Romantasy',
                'Science',
                'Science Fiction',
                'Self Help',
                'Suspense',
                'Spirituality',
                'Sports',
                'Thriller',
                'Travel',
                'Young Adult'
            );
        `);
    }

}
