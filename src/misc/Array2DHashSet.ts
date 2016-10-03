﻿/*
 * [The "BSD license"]
 *  Copyright (c) 2012 Terence Parr
 *  Copyright (c) 2012 Sam Harwell
 *  All rights reserved.
 *
 *  Redistribution and use in source and binary forms, with or without
 *  modification, are permitted provided that the following conditions
 *  are met:
 *
 *  1. Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 *  2. Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in the
 *     documentation and/or other materials provided with the distribution.
 *  3. The name of the author may not be used to endorse or promote products
 *     derived from this software without specific prior written permission.
 *
 *  THIS SOFTWARE IS PROVIDED BY THE AUTHOR ``AS IS'' AND ANY EXPRESS OR
 *  IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 *  OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 *  IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT,
 *  INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT
 *  NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 *  DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 *  THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 *  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 *  THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

// ConvertTo-TS run at 2016-10-03T02:09:41.7434086-07:00

/** {@link Set} implementation with closed hashing (open addressing). */
export class Array2DHashSet<T> implements Set<T> {
	static INITAL_CAPACITY: number =  16; // must be power of 2
	static INITAL_BUCKET_CAPACITY: number =  8;
	static LOAD_FACTOR: number =  0.75;

	@NotNull
	protected comparator: AbstractEqualityComparator<? super T>; 

	protected buckets: T[][]; 

	/** How many elements in set */
	protected n: number =  0;

	protected threshold: number =  (int)(INITAL_CAPACITY * LOAD_FACTOR); // when to expand

	protected currentPrime: number =  1; // jump by 4 primes each expand or whatever
	protected initialBucketCapacity: number =  INITAL_BUCKET_CAPACITY;

	 constructor()  {
		this(null, INITAL_CAPACITY, INITAL_BUCKET_CAPACITY);
	}

	 constructor1(@Nullable comparator: AbstractEqualityComparator<? super T>)  {
		this(comparator, INITAL_CAPACITY, INITAL_BUCKET_CAPACITY);
	}

	 constructor2(@Nullable comparator: AbstractEqualityComparator<? super T>, initialCapacity: number, initialBucketCapacity: number)  {
		if (comparator == null) {
			comparator = ObjectEqualityComparator.INSTANCE;
		}

		this.comparator = comparator;
		this.buckets = createBuckets(initialCapacity);
		this.initialBucketCapacity = initialBucketCapacity;
	}

	/**
	 * Add {@code o} to set if not there; return existing value if already
	 * there. This method performs the same operation as {@link #add} aside from
	 * the return value.
	 */
	getOrAdd(o: T): T {
		if ( n > threshold ) expand();
		return getOrAddImpl(o);
	}

	protected getOrAddImpl(o: T): T {
		let b: number =  getBucket(o);
		let bucket: T[] =  buckets[b];

		// NEW BUCKET
		if ( bucket==null ) {
			bucket = createBucket(initialBucketCapacity);
			bucket[0] = o;
			buckets[b] = bucket;
			n++;
			return o;
		}

		// LOOK FOR IT IN BUCKET
		for (let i=0; i<bucket.length; i++) {
			let existing: T =  bucket[i];
			if ( existing==null ) { // empty slot; not there, add.
				bucket[i] = o;
				n++;
				return o;
			}
			if ( comparator.equals(existing, o) ) return existing; // found existing, quit
		}

		// FULL BUCKET, expand and add to end
		let oldLength: number =  bucket.length;
		bucket = Arrays.copyOf(bucket, bucket.length * 2);
		buckets[b] = bucket;
		bucket[oldLength] = o; // add to end
		n++;
		return o;
	}

	get(o: T): T {
		if ( o==null ) return o;
		let b: number =  getBucket(o);
		let bucket: T[] =  buckets[b];
		if ( bucket==null ) return null; // no bucket
		for (let e of bucket) {
			if ( e==null ) return null; // empty slot; not there
			if ( comparator.equals(e, o) ) return e;
		}
		return null;
	}

	protected getBucket(o: T): number {
		let hash: number =  comparator.hashCode(o);
		let b: number =  hash & (buckets.length-1); // assumes len is power of 2
		return b;
	}

	@Override
	hashCode(): number {
		let hash: number =  MurmurHash.initialize();
		for (let bucket of buckets) {
			if ( bucket==null ) continue;
			for (let o of bucket) {
				if ( o==null ) break;
				hash = MurmurHash.update(hash, comparator.hashCode(o));
			}
		}

		hash = MurmurHash.finish(hash, size());
		return hash;
	}

	@Override
	equals(o: any): boolean {
		if (o == this) return true;
		if ( !(o instanceof Array2DHashSet) ) return false;
		let other: Array2DHashSet<?> =  (Array2DHashSet<?>)o;
		if ( other.size() != size() ) return false;
		let same: boolean =  this.containsAll(other);
		return same;
	}

	protected expand(): void {
		let old: T[][] =  buckets;
		currentPrime += 4;
		let newCapacity: number =  buckets.length * 2;
		let newTable: T[][] =  createBuckets(newCapacity);
		let newBucketLengths: number[] =  new int[newTable.length];
		buckets = newTable;
		threshold = (int)(newCapacity * LOAD_FACTOR);
//		System.out.println("new size="+newCapacity+", thres="+threshold);
		// rehash all existing entries
		let oldSize: number =  size();
		for (let bucket of old) {
			if ( bucket==null ) {
				continue;
			}

			for (let o of bucket) {
				if ( o==null ) {
					break;
				}

				let b: number =  getBucket(o);
				let bucketLength: number =  newBucketLengths[b];
				let newBucket: T[]; 
				if (bucketLength == 0) {
					// new bucket
					newBucket = createBucket(initialBucketCapacity);
					newTable[b] = newBucket;
				}
				else {
					newBucket = newTable[b];
					if (bucketLength == newBucket.length) {
						// expand
						newBucket = Arrays.copyOf(newBucket, newBucket.length * 2);
						newTable[b] = newBucket;
					}
				}

				newBucket[bucketLength] = o;
				newBucketLengths[b]++;
			}
		}

		assert(n == oldSize);
	}

	@Override
	add(t: T): boolean {
		let existing: T =  getOrAdd(t);
		return existing==t;
	}

	@Override
	size(): number {
		return n;
	}

	@Override
	isEmpty(): boolean {
		return n==0;
	}

	@Override
	contains(o: any): boolean {
		return containsFast(asElementType(o));
	}

	containsFast(@Nullable obj: T): boolean {
		if (obj == null) {
			return false;
		}

		return get(obj) != null;
	}

	@Override
	iterator(): Iterator<T> {
		return new SetIterator(toArray());
	}

	@Override
	toArray(): T[] {
		let a: T[] =  createBucket(size());
		let i: number =  0;
		for (let bucket of buckets) {
			if ( bucket==null ) {
				continue;
			}

			for (let o of bucket) {
				if ( o==null ) {
					break;
				}

				a[i++] = o;
			}
		}

		return a;
	}

	@Override
	toArray<U>(a: U[]): U[] {
		if (a.length < size()) {
			a = Arrays.copyOf(a, size());
		}

		let i: number =  0;
		for (let bucket of buckets) {
			if ( bucket==null ) {
				continue;
			}

			for (let o of bucket) {
				if ( o==null ) {
					break;
				}

				@SuppressWarnings("unchecked") // array store will check this
				let targetElement: U =  (U)o;
				a[i++] = targetElement;
			}
		}
		return a;
	}

	@Override
	remove(o: any): boolean {
		return removeFast(asElementType(o));
	}

	removeFast(@Nullable obj: T): boolean {
		if (obj == null) {
			return false;
		}

		let b: number =  getBucket(obj);
		let bucket: T[] =  buckets[b];
		if ( bucket==null ) {
			// no bucket
			return false;
		}

		for (let i=0; i<bucket.length; i++) {
			let e: T =  bucket[i];
			if ( e==null ) {
				// empty slot; not there
				return false;
			}

			if ( comparator.equals(e, obj) ) {          // found it
				// shift all elements to the right down one
				System.arraycopy(bucket, i+1, bucket, i, bucket.length-i-1);
				bucket[bucket.length - 1] = null;
				n--;
				return true;
			}
		}

		return false;
	}

	@Override
	containsAll(collection: Collection<any>): boolean {
		if ( collection instanceof Array2DHashSet ) {
			let s: Array2DHashSet<?> =  (Array2DHashSet<?>)collection;
			for (let bucket of s.buckets) {
				if ( bucket==null ) continue;
				for (let o of bucket) {
					if ( o==null ) break;
					if ( !this.containsFast(asElementType(o)) ) return false;
				}
			}
		}
		else {
			for (let o of collection) {
				if ( !this.containsFast(asElementType(o)) ) return false;
			}
		}
		return true;
	}

	@Override
	addAll(c: Collection<? extends T>): boolean {
		let changed: boolean =  false;
		for (let o of c) {
			let existing: T =  getOrAdd(o);
			if ( existing!=o ) changed=true;
		}
		return changed;
	}

	@Override
	retainAll(c: Collection<any>): boolean {
		let newsize: number =  0;
		for (let bucket of buckets) {
			if (bucket == null) {
				continue;
			}

			let i: number; 
			let j: number; 
			for (i = 0, j = 0; i < bucket.length; i++) {
				if (bucket[i] == null) {
					break;
				}

				if (!c.contains(bucket[i])) {
					// removed
					continue;
				}

				// keep
				if (i != j) {
					bucket[j] = bucket[i];
				}

				j++;
				newsize++;
			}

			newsize += j;

			while (j < i) {
				bucket[j] = null;
				j++;
			}
		}

		let changed: boolean =  newsize != n;
		n = newsize;
		return changed;
	}

	@Override
	removeAll(c: Collection<any>): boolean {
		let changed: boolean =  false;
		for (let o of c) {
			changed |= removeFast(asElementType(o));
		}

		return changed;
	}

	@Override
	clear(): void {
		buckets = createBuckets(INITAL_CAPACITY);
		n = 0;
	}

	@Override
	toString(): string {
		if ( size()==0 ) return "{}";

		let buf: StringBuilder =  new StringBuilder();
		buf.append('{');
		let first: boolean =  true;
		for (let bucket of buckets) {
			if ( bucket==null ) continue;
			for (let o of bucket) {
				if ( o==null ) break;
				if ( first ) first=false;
				else buf.append(", ");
				buf.append(o.toString());
			}
		}
		buf.append('}');
		return buf.toString();
	}

	toTableString(): string {
		let buf: StringBuilder =  new StringBuilder();
		for (let bucket of buckets) {
			if ( bucket==null ) {
				buf.append("null\n");
				continue;
			}
			buf.append('[');
			let first: boolean =  true;
			for (let o of bucket) {
				if ( first ) first=false;
				else buf.append(" ");
				if ( o==null ) buf.append("_");
				else buf.append(o.toString());
			}
			buf.append("]\n");
		}
		return buf.toString();
	}

	/**
	 * Return {@code o} as an instance of the element type {@code T}. If
	 * {@code o} is non-null but known to not be an instance of {@code T}, this
	 * method returns {@code null}. The base implementation does not perform any
	 * type checks; override this method to provide strong type checks for the
	 * {@link #contains} and {@link #remove} methods to ensure the arguments to
	 * the {@link EqualityComparator} for the set always have the expected
	 * types.
	 *
	 * @param o the object to try and cast to the element type of the set
	 * @return {@code o} if it could be an instance of {@code T}, otherwise
	 * {@code null}.
	 */
	@SuppressWarnings("unchecked")
	protected asElementType(o: any): T {
		return (T)o;
	}

	/**
	 * Return an array of {@code T[]} with length {@code capacity}.
	 *
	 * @param capacity the length of the array to return
	 * @return the newly constructed array
	 */
	@SuppressWarnings("unchecked")
	protected createBuckets(capacity: number): T[][] {
		return (T[][])new Object[capacity][];
	}

	/**
	 * Return an array of {@code T} with length {@code capacity}.
	 *
	 * @param capacity the length of the array to return
	 * @return the newly constructed array
	 */
	@SuppressWarnings("unchecked")
	protected createBucket(capacity: number): T[] {
		return (T[])new Object[capacity];
	}

	protected class SetIterator implements Iterator<T> {
		data: T[]; 
		let nextIndex: number =  0;
		let removed: boolean =  true;

		public SetIterator(T[] data) {
			this.data = data;
		}

		@Override
		hasNext(): boolean {
			return nextIndex < data.length;
		}

		@Override
		next(): T {
			if (!hasNext()) {
				throw new NoSuchElementException();
			}

			removed = false;
			return data[nextIndex++];
		}

		@Override
		remove(): void {
			if (removed) {
				throw new IllegalStateException();
			}

			Array2DHashSet.this.remove(data[nextIndex - 1]);
			removed = true;
		}
	}
}
