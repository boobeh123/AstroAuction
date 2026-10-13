jest.mock('../../config/cloudinary');
jest.mock('../../model/Auction');
jest.mock('../../model/Comment');
jest.mock('../../model/Bid');
jest.mock('../../model/Message');

const cloudinary = require('../../config/cloudinary');
const Auction = require('../../model/Auction');
const Comment = require('../../model/Comment');
const Bid = require('../../model/Bid');
const Message = require('../../model/Message');
const { deleteListings } = require('../../services/listingCleanup');

/**
 * deleteListings removes listings together with everything that belongs to
 * them. Deleting one listing and deleting an account both use it. Whether its
 * queries really match on a database with the sanitizeFilter guard on is
 * checked in integration-database_test.js.
 */
const LAMP = { _id: 'lamp', cloudinaryIds: ['lamp-1', 'lamp-2'] };
const BOWL = { _id: 'bowl', cloudinaryIds: ['bowl-1'] };
const RUG = { _id: 'rug' }; // listed before photos were saved with listings

beforeEach(() => {
    jest.clearAllMocks();
    cloudinary.uploader.destroy.mockResolvedValue({ result: 'ok' });
    Auction.deleteMany.mockResolvedValue({});
    Comment.deleteMany.mockResolvedValue({});
    Bid.deleteMany.mockResolvedValue({});
    Message.deleteMany.mockResolvedValue({});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

test('removes every photo of every listing from Cloudinary', async () => {
    await deleteListings([LAMP, BOWL, RUG]);

    expect(cloudinary.uploader.destroy.mock.calls.map(([id]) => id)).toEqual(['lamp-1', 'lamp-2', 'bowl-1']);
});

test('deletes the listings along with their comments, messages and bids', async () => {
    await deleteListings([LAMP, BOWL]);

    expect(Comment.deleteMany.mock.calls[0][0].auction.$in).toEqual(['lamp', 'bowl']);
    expect(Message.deleteMany.mock.calls[0][0].auction.$in).toEqual(['lamp', 'bowl']);
    expect(Bid.deleteMany.mock.calls[0][0].auction.$in).toEqual(['lamp', 'bowl']);
    expect(Auction.deleteMany.mock.calls[0][0]._id.$in).toEqual(['lamp', 'bowl']);
});

// A leftover file in Cloudinary is better than a listing nobody can remove
test('keeps going when a photo fails to delete', async () => {
    cloudinary.uploader.destroy.mockRejectedValueOnce(new Error('Cloudinary is down'));

    await deleteListings([LAMP]);

    expect(Auction.deleteMany).toHaveBeenCalled();
});

test('does nothing when there are no listings', async () => {
    await deleteListings([]);

    expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
    expect(Auction.deleteMany).not.toHaveBeenCalled();
});
